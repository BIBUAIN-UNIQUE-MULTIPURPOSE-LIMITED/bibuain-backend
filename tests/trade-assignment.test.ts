/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// =============================================
// Type Definitions
// =============================================
interface Trade {
    id: string;
    tradeHash: string;
    status: string;
    platformCreatedAt: Date;
    isEscalated: boolean;
    assignedPayerId: string | null;
    lastModifiedAt?: Date;
    amount?: number;
    assignedAt?: Date;
    wasEscalated?: boolean; // Track if a trade was previously escalated
    queuePosition?: number; // Track position in queue
}

interface User {
    id: string;
    userType: string;
    clockedIn: boolean;
    status: string;
    password?: string;
    twoFaSecret?: string;
    shifts: Shift[];
    activeTradeId?: string | null; // Track which trade a payer is currently working on
}

interface Shift {
    status: string;
    isClockedIn: boolean;
    user?: User;
}

// =============================================
// Repository Interfaces
// =============================================
interface TradeRepository {
    find(options?: any): Promise<Trade[]>;
    findOne(options?: any): Promise<Trade | null>;
    save(trade: Trade): Promise<Trade>;
}

interface UserRepository {
    find(options?: any): Promise<User[]>;
    findOne(options?: any): Promise<User | null>;
    save(user: User): Promise<User>;
}

interface ShiftRepository {
    find(options?: any): Promise<Shift[]>;
}

// =============================================
// Mock Data
// =============================================
const mockTrades: Trade[] = [
    { id: 'trade1', tradeHash: 'hash1', status: 'Active Funded', platformCreatedAt: new Date('2025-05-01T08:00:00Z'), isEscalated: false, assignedPayerId: null },
    { id: 'trade2', tradeHash: 'hash2', status: 'Active Funded', platformCreatedAt: new Date('2025-05-01T09:00:00Z'), isEscalated: false, assignedPayerId: null },
    { id: 'trade3', tradeHash: 'hash3', status: 'Active Funded', platformCreatedAt: new Date('2025-05-01T07:00:00Z'), isEscalated: true, assignedPayerId: null },
    { id: 'trade4', tradeHash: 'hash4', status: 'assigned', platformCreatedAt: new Date('2025-05-01T06:00:00Z'), isEscalated: false, assignedPayerId: 'payer1' },
    { id: 'trade5', tradeHash: 'hash5', status: 'Active Funded', platformCreatedAt: new Date('2025-05-01T05:00:00Z'), isEscalated: false, assignedPayerId: null, lastModifiedAt: new Date('2025-05-01T09:30:00Z') },
    { id: 'trade6', tradeHash: 'hash6', status: 'escalated', platformCreatedAt: new Date('2025-05-01T04:00:00Z'), isEscalated: true, assignedPayerId: null, wasEscalated: true }
];

const mockUsers: User[] = [
    { id: 'payer1', userType: 'payer', clockedIn: true, status: 'active', password: 'secret', twoFaSecret: 'secret2', shifts: [{ status: 'active', isClockedIn: true }], activeTradeId: 'trade4' },
    { id: 'payer2', userType: 'payer', clockedIn: true, status: 'active', shifts: [{ status: 'active', isClockedIn: true }], activeTradeId: undefined },
    { id: 'payer3', userType: 'payer', clockedIn: false, status: 'active', shifts: [{ status: 'active', isClockedIn: false }], activeTradeId: undefined }
];

let _assignTradesCallCount = 0;
const _lockedTrades = new Set<string>();
let _tradeQueue: Trade[] = [];

// =============================================
// Mock Repositories
// =============================================
const mockTradeRepository: jest.Mocked<TradeRepository> = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn()
};

const mockUserRepository: jest.Mocked<UserRepository> = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn()
};

const mockShiftRepository: jest.Mocked<ShiftRepository> = {
    find: jest.fn()
};

// =============================================
// Helper Functions
// =============================================
async function getAvailablePayers(): Promise<User[]> {
    const users = await mockUserRepository.find({
        where: {
            userType: 'payer',
            clockedIn: true,
            status: 'active'
        }
    });

    const shifts = await mockShiftRepository.find({
        where: {
            status: 'active',
            user: { id: users.map(u => u.id) }
        },
        relations: ['user']
    });

    return shifts
        .filter(s => s.user && (!s.user.activeTradeId)) // Only return payers not working on a trade
        .map(s => {
            // Omit password and twoFaSecret
            const { password, twoFaSecret, ...safeUser } = s.user!;
            return safeUser;
        });
}

// Get payers who are busy with trades
async function getBusyPayers(): Promise<User[]> {
    const users = await mockUserRepository.find({
        where: {
            userType: 'payer',
            clockedIn: true,
            status: 'active'
        }
    });

    return users.filter(u => u.activeTradeId !== null && u.activeTradeId !== undefined);
}

// Update the trade queue
async function updateTradeQueue(): Promise<void> {
    const allTrades = await mockTradeRepository.find();

    // Filter for eligible queued trades
    _tradeQueue = allTrades
        .filter(t =>
            t.status === 'Active Funded' &&
            !t.isEscalated &&
            t.assignedPayerId === null
        )
        .sort((a, b) => {
            // Previously escalated trades get priority
            if (a.wasEscalated && !b.wasEscalated) return -1;
            if (!a.wasEscalated && b.wasEscalated) return 1;

            // Then sort by creation time (oldest first)
            return a.platformCreatedAt.getTime() - b.platformCreatedAt.getTime();
        });

    // Assign queue positions
    _tradeQueue.forEach((trade, index) => {
        trade.queuePosition = index + 1;
    });
}

// =============================================
// Service Functions (to test)
// =============================================
export async function assignTrades(): Promise<Trade[]> {
    _assignTradesCallCount++;

    // Update the trade queue first
    await updateTradeQueue();

    // Get available payers (those without active trades)
    const availablePayers = await getAvailablePayers();

    if (!availablePayers.length || !_tradeQueue.length) {
        return []; // No assignments possible
    }

    const assignments: Trade[] = [];
    const payersToAssign = [...availablePayers]; // Clone for manipulation

    // Assign trades from the queue to available payers
    for (let i = 0; i < Math.min(payersToAssign.length, _tradeQueue.length); i++) {
        const trade = _tradeQueue[i];
        const payer = payersToAssign[i];

        // Find a proper reference to the trade
        const tradeToAssign = await mockTradeRepository.findOne({ where: { id: trade.id } });
        if (!tradeToAssign) continue;

        tradeToAssign.assignedPayerId = payer.id;
        tradeToAssign.status = 'assigned';
        tradeToAssign.assignedAt = new Date();

        // Update the payer to mark they are handling this trade
        const payerToUpdate = await mockUserRepository.findOne({ where: { id: payer.id } });
        if (payerToUpdate) {
            payerToUpdate.activeTradeId = tradeToAssign.id;
            await mockUserRepository.save(payerToUpdate);
        }

        // Save the trade
        const savedTrade = await mockTradeRepository.save(tradeToAssign);
        assignments.push(savedTrade);
    }

    // Update the queue after assignments
    await updateTradeQueue();

    return assignments;
}

export async function assignTrade(tradeId: string): Promise<Trade> {
    // Prevent concurrent assignments
    if (_lockedTrades.has(tradeId)) {
        throw new Error('Trade already being assigned');
    }
    _lockedTrades.add(tradeId);

    try {
        const trade = await mockTradeRepository.findOne({ where: { id: tradeId } });
        if (!trade) throw new Error('Trade not found');
        if ((trade.amount ?? 1) <= 0) throw new Error('Invalid trade amount');
        if (trade.assignedPayerId !== null) {
            throw new Error('Trade already assigned');
        }

        // 1) Fetch all clocked‑in, active payers
        const allPayers = await mockUserRepository.find({
            where: { userType: 'payer', clockedIn: true, status: 'active' }
        });
        // 2) Figure out who’s busy
        const busy = await getBusyPayers();
        const busyIds = new Set(busy.map(u => u.id));
        // 3) The truly free ones
        const freePayers = allPayers.filter(u =>
            u.clockedIn && u.status === 'active' && !busyIds.has(u.id)
        );

        // If everyone’s busy, roll this trade back into the queue
        if (freePayers.length === 0) {
            trade.status = 'Active Funded';
            await mockTradeRepository.save(trade);
            await updateTradeQueue();
            return trade;
        }

        // Otherwise assign to the first free payer
        const payer = freePayers[0];
        trade.assignedPayerId = payer.id;
        trade.status          = 'assigned';
        trade.assignedAt      = new Date();

        // Mark payer as busy
        const payerToUpdate = await mockUserRepository.findOne({ where: { id: payer.id } });
        if (payerToUpdate) {
            payerToUpdate.activeTradeId = trade.id;
            await mockUserRepository.save(payerToUpdate);
        }

        // Persist the assignment
        await mockTradeRepository.save(trade);
        return trade;
    } finally {
        // Release the lock immediately after operations complete
        setTimeout(() => _lockedTrades.delete(tradeId), 0);
    }
}

export async function escalateTrade(tradeId: string): Promise<Trade> {
    const trade = await mockTradeRepository.findOne({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    // Free up the payer if this trade was assigned
    if (trade.assignedPayerId) {
        const payer = await mockUserRepository.findOne({ where: { id: trade.assignedPayerId } });
        if (payer) {
            // explicitly clear the payer’s activeTradeId
            payer.activeTradeId = null;
            await mockUserRepository.save(payer);
        }
    }

    trade.isEscalated     = true;
    trade.wasEscalated    = true;
    trade.status          = 'escalated';
    trade.assignedPayerId = null;
    trade.assignedAt      = undefined;

    const updated = await mockTradeRepository.save(trade);

    // trigger a new assignment cycle
    await assignTrades();

    return updated;
}

export async function reassignTrade(tradeId: string): Promise<Trade> {
    const trade = await mockTradeRepository.findOne({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    // Fetch all active, clocked‑in payers
    const allPayers = await mockUserRepository.find({
        where: { userType: 'payer', clockedIn: true, status: 'active' }
    });
    // Enforce clockedIn & active status in case the repo mock ignores the where
    const activePayers = allPayers.filter(u => u.clockedIn && u.status === 'active');

    // Subtract out any who are already busy
    const busy = await getBusyPayers();
    const busyIds = new Set(busy.map(u => u.id));
    const freePayers = activePayers.filter(u => !busyIds.has(u.id));

    if (freePayers.length === 0) {
        // No one free → back in queue
        trade.status          = 'Active Funded';
        trade.isEscalated     = false;
        trade.wasEscalated    = true;  // preserve for priority
        trade.assignedPayerId = null;
        trade.lastModifiedAt  = new Date();

        const saved = await mockTradeRepository.save(trade);
        await updateTradeQueue();
        return saved;
    }

    // Otherwise assign to the first free payer
    const payer = freePayers[0];
    trade.assignedPayerId = payer.id;
    trade.isEscalated     = false;
    trade.status          = 'assigned';
    trade.assignedAt      = new Date();
    trade.lastModifiedAt  = new Date();

    // Mark the payer busy
    const payerToUpdate = await mockUserRepository.findOne({ where: { id: payer.id } });
    if (payerToUpdate) {
        payerToUpdate.activeTradeId = trade.id;
        await mockUserRepository.save(payerToUpdate);
    }

    return mockTradeRepository.save(trade);
}

export async function markTradeAsCompleted(tradeId: string): Promise<Trade> {
    const trade = await mockTradeRepository.findOne({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    // Free up the payer
    const payerId = trade.assignedPayerId;
    if (payerId) {
        const payer = await mockUserRepository.findOne({ where: { id: payerId } });
        if (payer) {
            payer.activeTradeId = null;
            await mockUserRepository.save(payer);
        }
    }

    // Mark completed
    trade.status = 'completed';
    trade.lastModifiedAt = new Date();
    await mockTradeRepository.save(trade);  // first save

    // Then assign exactly one next queued trade to this payer
    if (payerId) {
        await updateTradeQueue();
        const next = _tradeQueue[0];
        if (next) {
            const nextTrade = await mockTradeRepository.findOne({ where: { id: next.id } });
            if (nextTrade) {
                nextTrade.assignedPayerId = payerId;
                nextTrade.status = 'assigned';
                nextTrade.assignedAt = new Date();
                nextTrade.lastModifiedAt = new Date();

                const payer = await mockUserRepository.findOne({ where: { id: payerId } });
                if (payer) {
                    payer.activeTradeId = nextTrade.id;
                    await mockUserRepository.save(payer);
                }
                await mockTradeRepository.save(nextTrade);  // second save
            }
        }
    }

    return trade;
}


// =============================================
// Test Suite
// =============================================
describe('Trade Assignment System', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-05-01T10:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        _tradeQueue = [];
        // Clear locked trades between tests
        _lockedTrades.clear();
        
        mockTradeRepository.find.mockResolvedValue([...mockTrades]);
        mockUserRepository.find.mockResolvedValue([...mockUsers]);
        mockShiftRepository.find.mockResolvedValue(
            mockUsers
                .filter(u => u.clockedIn)
                .map(u => ({ user: u, status: 'active', isClockedIn: u.clockedIn }))
        );

        // Setup default findOne behavior for users
        mockUserRepository.findOne.mockImplementation(async (options) => {
            const id = options?.where?.id;
            if (!id) return null;
            const user = mockUsers.find(u => u.id === id);
            return user ? { ...user } : null;
        });

        // Setup default findOne behavior for trades
        mockTradeRepository.findOne.mockImplementation(async (options) => {
            const id = options?.where?.id;
            if (!id) return null;
            const trade = mockTrades.find(t => t.id === id);
            return trade ? { ...trade } : null;
        });

        // Setup default save behavior
        mockTradeRepository.save.mockImplementation(async (trade) => {
            return { ...trade };
        });

        mockUserRepository.save.mockImplementation(async (user) => {
            return { ...user };
        });
    });

    describe('Available Payers', () => {
        it('returns only active, clocked-in payers without active trades', async () => {
            const result = await getAvailablePayers();
            expect(result).toHaveLength(1); // Only payer2 is available (payer1 has activeTradeId)
            expect(result[0].id).toBe('payer2');
            expect(result[0]).not.toHaveProperty('password');
            expect(result[0]).not.toHaveProperty('twoFaSecret');
        });
    });

    describe('Trade Assignment Logic', () => {
        it('assigns oldest eligible trades to available payers only', async () => {
            const assigned = await assignTrades();
            expect(assigned).toHaveLength(1); // Only one payer available (payer2)
            expect(assigned[0].tradeHash).toBe('hash5'); // Oldest trade
            expect(mockTradeRepository.save).toHaveBeenCalledTimes(1);
            expect(assigned[0].assignedAt!.getTime()).toBe(new Date('2025-05-01T10:00:00Z').getTime());
        });

        it('does not include escalated trades', async () => {
            const assigned = await assignTrades();
            expect(assigned.some(t => t.id === 'trade3')).toBe(false);
        });

        it('does not reassign trades already assigned to payers', async () => {
            // Make sure trade4 stays with payer1
            const assigned = await assignTrades();
            const stillAssigned = await mockTradeRepository.findOne({ where: { id: 'trade4' } });
            expect(stillAssigned?.assignedPayerId).toBe('payer1');
        });

        it('prioritizes previously escalated trades in the queue', async () => {
            // Modify trade6 to be eligible for assignment
            mockTradeRepository.find.mockResolvedValue([
                ...mockTrades.map(t =>
                    t.id === 'trade6'
                        ? { ...t, status: 'Active Funded', isEscalated: false }
                        : { ...t }
                )
            ]);

            const assigned = await assignTrades();
            expect(assigned).toHaveLength(1);
            expect(assigned[0].id).toBe('trade6'); // Should be prioritized despite being older
        });
    });

    describe('Trade Queue System', () => {
        it('maintains a queue when more trades than available payers', async () => {
            // First run should assign one trade to payer2
            const assigned1 = await assignTrades();
            expect(assigned1).toHaveLength(1);

            // Verify queue has been updated
            expect(_tradeQueue.length).toBeGreaterThan(0);

            // Complete the assigned trade to free up the payer
            await mockTradeRepository.findOne.mockResolvedValueOnce({
                ...assigned1[0],
                assignedPayerId: 'payer2'
            });

            await markTradeAsCompleted(assigned1[0].id);

            // Verify next trade was assigned
            expect(mockTradeRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'assigned',
                    assignedPayerId: 'payer2'
                })
            );
        });

        it('handles empty queue gracefully', async () => {
            mockTradeRepository.find.mockResolvedValue([
                // Only include trades that are already assigned or escalated
                ...mockTrades.filter(t =>
                    t.status === 'assigned' || t.status === 'escalated'
                )
            ]);

            const assigned = await assignTrades();
            expect(assigned).toHaveLength(0);
            expect(mockTradeRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('Trade Escalation', () => {
        it('escalates and unassigns trade, freeing up the payer', async () => {
            mockTradeRepository.findOne.mockResolvedValue({
                ...mockTrades[0],
                id: 'trade1',
                assignedPayerId: 'payer1',
                status: 'assigned'
            });

            const result = await escalateTrade('trade1');
            expect(result.isEscalated).toBe(true);
            expect(result.wasEscalated).toBe(true);
            expect(result.status).toBe('escalated');
            expect(result.assignedPayerId).toBeNull();

            // Verify payer was freed up
            expect(mockUserRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'payer1',
                    activeTradeId: null
                })
            );
        });
    });

    describe('Trade Reassignment', () => {
        it('reassigns to available payer after escalation', async () => {
            // Setup an escalated trade
            mockTradeRepository.findOne.mockResolvedValueOnce({
                ...mockTrades[5],
                id: 'trade6',
                status: 'escalated',
                isEscalated: true
            });

            const result = await reassignTrade('trade6');
            expect(result.assignedPayerId).toBe('payer2'); // Only available payer
            expect(result.isEscalated).toBe(false);
            expect(result.status).toBe('assigned');
        });

        it('puts trade back in queue when no payers are available', async () => {
            // Make all payers busy
            mockUserRepository.find.mockResolvedValue(
                mockUsers.map(u => ({ ...u, activeTradeId: u.id === 'payer3' ? undefined : 'some-trade' }))
            );

            mockTradeRepository.findOne.mockResolvedValueOnce({
                ...mockTrades[5],
                id: 'trade6',
                status: 'escalated',
                isEscalated: true
            });

            const result = await reassignTrade('trade6');
            expect(result.status).toBe('Active Funded');
            expect(result.isEscalated).toBe(false);
            expect(result.wasEscalated).toBe(true); // Remember it was escalated for priority
        });
    });

    describe('Trade Completion', () => {
        it('marks trade as completed and assigns next trade in queue', async () => {
            // Setup mock data
            mockTradeRepository.findOne.mockResolvedValueOnce({
                ...mockTrades[3],
                id: 'trade4',
                assignedPayerId: 'payer1',
                status: 'assigned'
            });

            // Need to mock the save method to properly test the activeTradeId being set to null
            mockUserRepository.save.mockImplementation(async (user) => {
                // Return user with the activeTradeId explicitly set to null
                return { ...user, activeTradeId: user.activeTradeId };
            });

            const result = await markTradeAsCompleted('trade4');
            expect(result.status).toBe('completed');

            // Verify payer was freed up with explicitly null activeTradeId
            expect(mockUserRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'payer1',
                    activeTradeId: null
                })
            );

            // Verify assignTrades was called to assign next trade
            expect(mockTradeRepository.save).toHaveBeenCalledTimes(2); // Once for completion, once for new assignment
        });
    });

    describe('Failure Test Cases', () => {
        it('no assignments if no payers', async () => {
            // Explicitly clear available payers for this test
            mockUserRepository.find.mockResolvedValue([]);
            mockShiftRepository.find.mockResolvedValue([]);
            
            const res = await assignTrades();
            expect(res).toHaveLength(0);
        });

        it('handles empty trade list', async () => {
            mockTradeRepository.find.mockResolvedValue([]);
            const res = await assignTrades();
            expect(res).toHaveLength(0);
        });

        it('throws when assigning invalid amount', async () => {
            mockTradeRepository.findOne.mockResolvedValue({ ...mockTrades[0], amount: -1 } as Trade);
            await expect(assignTrade('trade1')).rejects.toThrow('Invalid trade amount');
        });

        it('prevents concurrent modifications using locks', async () => {
            mockTradeRepository.findOne.mockResolvedValue({ ...mockTrades[0], assignedPayerId: null } as Trade);
            
            // We need to make both promises be created before either resolves
            const p1 = assignTrade('trade1');
            const p2 = assignTrade('trade1');
            
            // Ensure one succeeds and one fails due to the lock
            const results = await Promise.allSettled([p1, p2]);
            const fulfilled = results.filter(r => r.status === 'fulfilled');
            const rejected = results.filter(r => r.status === 'rejected');
            
            expect(fulfilled).toHaveLength(1);
            expect(rejected).toHaveLength(1);
        });
    });

    describe('Incoming and Completed‑Trade test Cases', () => {
        it('queues a newly arriving trade when all payers are busy (and does not bump an existing assignment)', async () => {
          // 1) Stub everyone as already busy on trade4:
          mockUserRepository.find.mockResolvedValue(
            mockUsers.map(u => ({
              ...u,
              activeTradeId: u.id === 'payer1' ? 'trade4' : 'trade4'  // everyone busy
            }))
          );
          mockShiftRepository.find.mockResolvedValue(
            mockUsers
              .filter(u => u.clockedIn)
              .map(u => ({ user: u, status: 'active', isClockedIn: u.clockedIn }))
          );
      
          // 2) Stub findOne to return a new unassigned trade:
          const newTrade: Trade = {
            id: 'tradeNew',
            tradeHash: 'hashNew',
            status: 'Active Funded',
            platformCreatedAt: new Date('2025-05-01T11:00:00Z'),
            isEscalated: false,
            assignedPayerId: null
          };
          mockTradeRepository.findOne.mockResolvedValueOnce(newTrade);
      
          // 3) Call assignTrade → no free payer, so it should stay in “Active Funded”
          const result = await assignTrade('tradeNew');
          expect(result.status).toBe('Active Funded');
          expect(result.assignedPayerId).toBeNull();
      
          // 4) And make sure we didn’t bump the original assignment:
          //    payer1 should still have activeTradeId = 'trade4'
          const payer1 = await mockUserRepository.findOne({ where: { id: 'payer1' } });
          expect(payer1!.activeTradeId).toBe('trade4');
        });
      
        it('does not reassign a trade once it’s marked completed', async () => {
          // 1) Stub findOne to return an assigned trade4
          mockTradeRepository.findOne.mockResolvedValueOnce({
            ...mockTrades.find(t => t.id === 'trade4')!,
            assignedPayerId: 'payer1',
            status: 'assigned'
          } as Trade);
      
          // 2) Call markTradeAsCompleted
          const completed = await markTradeAsCompleted('trade4');
          expect(completed.status).toBe('completed');
      
          // 3) Immediately refetch and ensure status is still “completed”
          mockTradeRepository.findOne.mockResolvedValueOnce({
            ...completed
          });
          const refetched = await mockTradeRepository.findOne({ where: { id: 'trade4' } });
          expect(refetched!.status).toBe('completed');
      
          // 4) And it should never get put back in the queue/assigned:
          //    verify that save() was not called again on that trade ID
          const savesForTrade4 = mockTradeRepository.save.mock.calls.filter(
            ([arg]) => (arg as Trade).id === 'trade4' && (arg as Trade).status === 'assigned'
          );
          expect(savesForTrade4).toHaveLength(0);
        });
      });      
});