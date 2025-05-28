import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { mockDbConnect, mockQueryRunner, mockIo, mockPlatformServices } from './setup';
import * as tradeController from '../src/controllers/tradeController'; // Import entire module
import { Trade, TradeStatus, TradePlatform } from '../src/models/trades';
import { User, UserType } from '../src/models/user';
import { Shift, ShiftStatus } from '../src/models/shift';
import { Bank, BankTag } from '../src/models/bank';
import { Account, ForexPlatform } from '../src/models/accounts';

// Mock the tradeController module
jest.mock('../src/controllers/tradeController', () => {
  const originalModule = jest.requireActual('../src/controllers/tradeController');
  return {
    ...originalModule,
    initializePlatformServices: jest.fn().mockResolvedValue(mockPlatformServices),
  };
});

// Mock data
const mockUsers: Partial<User>[] = [
  {
    id: 'payer1',
    userType: UserType.PAYER,
    clockedIn: true,
    status: 'active',
    fullName: 'Payer One',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'payer2',
    userType: UserType.PAYER,
    clockedIn: true,
    status: 'active',
    fullName: 'Payer Two',
    createdAt: new Date('2025-01-02'),
  },
  {
    id: 'cc1',
    userType: UserType.CC,
    clockedIn: true,
    status: 'active',
    fullName: 'CC Agent',
    createdAt: new Date('2025-01-03'),
  },
];

const mockShifts: Partial<Shift>[] = [
  {
    id: 'shift1',
    status: ShiftStatus.ACTIVE,
    user: mockUsers[0] as User,
  },
  {
    id: 'shift2',
    status: ShiftStatus.ACTIVE,
    user: mockUsers[1] as User,
  },
];

const mockTrades: Partial<Trade>[] = [
  {
    id: 'trade1',
    tradeHash: 'hash1',
    status: TradeStatus.ASSIGNED,
    assignedPayerId: 'payer1',
    isEscalated: false,
    platform: TradePlatform.PAXFUL,
    accountId: 'account1',
    amount: 100,
    assignedPayer: mockUsers[0] as User,
    assignedAt: new Date(),
    platformCreatedAt: new Date('2025-05-01T08:00:00Z'),
  },
  {
    id: 'trade2',
    tradeHash: 'hash2',
    status: TradeStatus.ESCALATED,
    assignedPayerId: null,
    isEscalated: true,
    platform: TradePlatform.PAXFUL,
    accountId: 'account1',
    amount: 150,
    escalationReason: 'Payment issue',
    escalatedById: 'payer1',
    platformCreatedAt: new Date('2025-05-01T09:00:00Z'),
  },
  {
    id: 'trade3',
    tradeHash: 'hash3',
    status: TradeStatus.ACTIVE_FUNDED,
    assignedPayerId: null,
    isEscalated: false,
    platform: TradePlatform.PAXFUL, // Use enum value instead of string
    accountId: 'account1',
    amount: 75,
    platformCreatedAt: new Date('2025-05-01T07:00:00Z'),
  },
  {
    id: 'trade4',
    tradeHash: 'hash4',
    status: TradeStatus.ACTIVE_FUNDED,
    assignedPayerId: null,
    isEscalated: false,
    platform: "paxful",
    accountId: 'account1',
    amount: 200,
    platformCreatedAt: new Date('2025-05-01T06:00:00Z'),
  },
];

const mockBanks: Partial<Bank>[] = [
  {
    id: 'bank1',
    funds: 1000,
    tag: BankTag.PRIMARY,
    logs: [],
    shift: mockShifts[0] as Shift,
  },
];

const mockAccounts: Partial<Account>[] = [
  { id: 'account1', platform: ForexPlatform.PAXFUL, api_key: 'key', api_secret: 'secret' },
];

// Helper functions for creating Express objects
const createMockRequest = (params: any = {}, body: any = {}): Partial<Request> => ({
  params,
  body,
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    data: null,
  };
  res.json.mockImplementation((data: any) => {
    res.data = data;
    return res;
  });
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Trade Controller Tests', () => {
  let mockTradeRepo: any;
  let mockUserRepo: any;
  let mockShiftRepo: any;
  let mockBankRepo: any;
  let mockAccountRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup proper platform services mock with correct accountId
    mockPlatformServices.paxful = [
      {
        accountId: 'account1',
        markTradeAsPaid: jest.fn().mockResolvedValue(true as never),
        listActiveTrades: jest.fn().mockResolvedValue([]),
      }
    ];
    mockPlatformServices.noones = [];
    mockPlatformServices.binance = [];

    // Mock the initializePlatformServices function
    (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices as never);

    mockDbConnect.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined as never);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined as never);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined as never);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined as never);
    mockQueryRunner.release.mockResolvedValue(undefined as never);

    mockTradeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockUserRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockShiftRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockBankRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockAccountRepo = {
      find: jest.fn().mockResolvedValue(mockAccounts as never),
    };

    mockDbConnect.getRepository = jest.fn().mockImplementation((entity: any) => {
      const entityName = typeof entity === 'string' ? entity : entity.name;
      switch (entityName) {
        case 'Trade':
          return mockTradeRepo;
        case 'User':
          return mockUserRepo;
        case 'Shift':
          return mockShiftRepo;
        case 'Bank':
          return mockBankRepo;
        case 'Account':
          return mockAccountRepo;
        default:
          return mockTradeRepo;
      }
    });

    mockQueryRunner.manager.getRepository = jest.fn().mockImplementation((entity: any) => {
      const entityName = typeof entity === 'string' ? entity : entity.name;
      switch (entityName) {
        case 'Trade':
          return mockTradeRepo;
        case 'User':
          return mockUserRepo;
        case 'Shift':
          return mockShiftRepo;
        case 'Bank':
          return mockBankRepo;
        case 'Account':
          return mockAccountRepo;
        default:
          return mockTradeRepo;
      }
    });

    mockQueryRunner.manager.find = mockTradeRepo.find;
    mockQueryRunner.manager.findOne = mockTradeRepo.findOne;
    mockQueryRunner.manager.save = mockTradeRepo.save;
    mockQueryRunner.manager.update = mockTradeRepo.update;
    mockQueryRunner.manager.delete = mockTradeRepo.delete;
  });

  describe('Additional Trade Controller Scenarios', () => {
    it('1. should assign oldest trade first', async () => {
  // Setup active trades data that matches what the controller expects
  const activeTrades = [
    { 
      trade_hash: 'hash4',
      trade_status: 'active funded',
      accountId: 'account1',
      platform: 'paxful',
      started_at: '2025-05-01T06:00:00.000Z', // This is what gets converted to platformCreatedAt
      fiat_amount_requested: 200,
      crypto_amount_requested: 0.002,
      crypto_amount_total: 0.002,
      fee_crypto_amount: 0.0001,
      fee_percentage: 1.5,
      source_id: 'source4',
      responder_username: 'responder4',
      owner_username: 'owner4',
      payment_method_name: 'Bank Transfer',
      location_iso: 'NG',
      fiat_currency_code: 'NGN',
      crypto_currency_code: 'BTC',
      is_active_offer: true,
      offer_hash: 'offer4',
      margin: 2.5,
      fiat_price_per_btc: 50000000,
      fiat_price_per_crypto: 50000000,
      crypto_current_rate_usd: 45000
    },
    { 
      trade_hash: 'hash3',
      trade_status: 'active funded',
      accountId: 'account1',
      platform: 'paxful',
      started_at: '2025-05-01T07:00:00.000Z', // This is newer, so should be assigned second
      fiat_amount_requested: 75,
      crypto_amount_requested: 0.0015,
      crypto_amount_total: 0.0015,
      fee_crypto_amount: 0.00008,
      fee_percentage: 1.5,
      source_id: 'source3',
      responder_username: 'responder3',
      owner_username: 'owner3',
      payment_method_name: 'Bank Transfer',
      location_iso: 'NG',
      fiat_currency_code: 'NGN',
      crypto_currency_code: 'BTC',
      is_active_offer: true,
      offer_hash: 'offer3',
      margin: 2.5,
      fiat_price_per_btc: 50000000,
      fiat_price_per_crypto: 50000000,
      crypto_current_rate_usd: 45000
    },
  ];

  const availablePayers = [{ 
    ...mockUsers[0], 
    id: 'payer1', 
    clockedIn: true,
    userType: UserType.PAYER,
    status: 'active',
    fullName: 'Payer One'
  }];

  // Setup platform services mock
  mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
  
  // Mock the repository methods for getting available payers
  mockUserRepo.find.mockResolvedValue(availablePayers);
  mockShiftRepo.find.mockResolvedValue([{
    id: 'shift1',
    status: ShiftStatus.ACTIVE,
    user: availablePayers[0]
  }]);

  // Mock existing trades in database (both should exist and be ACTIVE_FUNDED)
  const existingDbTrades = [
    {
      id: 'trade4',
      tradeHash: 'hash4',
      status: TradeStatus.ACTIVE_FUNDED,
      assignedPayerId: null,
      isEscalated: false,
      platform: 'paxful',
      accountId: 'account1',
      amount: 200,
      platformCreatedAt: new Date('2025-05-01T06:00:00.000Z'),
    },
    {
      id: 'trade3',
      tradeHash: 'hash3',
      status: TradeStatus.ACTIVE_FUNDED,
      assignedPayerId: null,
      isEscalated: false,
      platform: 'paxful',
      accountId: 'account1',
      amount: 75,
      platformCreatedAt: new Date('2025-05-01T07:00:00.000Z'),
    }
  ];

  // Mock queryRunner.manager.find for finding existing trades by hash
  mockQueryRunner.manager.find
    .mockResolvedValueOnce(existingDbTrades) // First call - get existing trades by hash
    .mockResolvedValueOnce([]); // Second call - get assigned trades (none initially)

  // Mock queryRunner.manager.findOne for individual trade lookups during assignment
  // The controller will try to find and lock each trade individually
  mockQueryRunner.manager.findOne
    .mockResolvedValueOnce(existingDbTrades[0]) // First trade (oldest - hash4)
    .mockResolvedValueOnce(existingDbTrades[1]); // Second trade (newer - hash3)

  // Mock save to return the updated trade
  const savedTrade = {
    ...existingDbTrades[0],
    status: TradeStatus.ASSIGNED,
    assignedPayerId: 'payer1',
    assignedAt: new Date(),
  };
  mockQueryRunner.manager.save.mockResolvedValue(savedTrade);

  // Mock initializePlatformServices
  (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

  // Execute the function
  const result = await tradeController.assignLiveTradesInternal();

  // Verify the oldest trade (hash4) was assigned first
  expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'trade4',
      status: TradeStatus.ASSIGNED,
      assignedPayerId: 'payer1',
    })
  );
  
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('trade4'); // Should be the oldest trade
  expect(result[0].assignedPayerId).toBe('payer1');
    });

    it('2. should queue trades if all payers are busy', async () => {
      const activeTrades = [mockTrades[2], mockTrades[3]];
      const availablePayers = [mockUsers[0]];
      const assignedTrades = [{ ...mockTrades[1], assignedPayerId: 'payer1' }];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(activeTrades);
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find.mockResolvedValue(assignedTrades);

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: TradeStatus.ASSIGNED }),
      );
      expect(result).toEqual([]);
    });

    it('3. should assign queued trades to free payer with oldest first', async () => {
      const activeTrades = [mockTrades[3], mockTrades[2]]; // trade4 is older
      const availablePayers = [mockUsers[0], mockUsers[1]];

      // First call: all payers busy
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValueOnce(activeTrades);
      mockUserRepo.find.mockResolvedValueOnce(availablePayers);
      mockShiftRepo.find.mockResolvedValueOnce([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        { ...mockTrades[1], assignedPayerId: 'payer1' },
        { ...mockTrades[1], assignedPayerId: 'payer2' },
      ]);
      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);
      await tradeController.assignLiveTradesInternal();

      // Second call: one payer becomes free
      mockTradeRepo.find.mockResolvedValueOnce(activeTrades);
      mockUserRepo.find.mockResolvedValueOnce(availablePayers);
      mockShiftRepo.find.mockResolvedValueOnce([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockTrades[3],
        id: 'trade4',
        tradeHash: 'hash4',
        status: TradeStatus.ACTIVE_FUNDED,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[3],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
      });

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade4',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        }),
      );
      expect(result[0].id).toBe('trade4');
    });

    it('4. should escalate trade successfully', async () => {
      const trade = { ...mockTrades[0] };
      const ccAgent = mockUsers[2];

      mockTradeRepo.findOne.mockResolvedValue(trade);
      mockUserRepo.findOne.mockResolvedValue(ccAgent);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        isEscalated: true,
        status: TradeStatus.ESCALATED,
        assignedPayerId: null,
        escalationReason: 'Payment dispute',
        escalatedById: 'payer1',
      });

      const req = createMockRequest({ tradeId: 'trade1' }, { reason: 'Payment dispute', escalatedById: 'payer1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.escalateTrade(req as Request, res as Response, next);

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          isEscalated: true,
          status: TradeStatus.ESCALATED,
          assignedPayerId: null,
        }),
      );
      expect(mockIo.emit).toHaveBeenCalledWith('tradeEscalated', { tradeId: 'trade1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Trade escalated successfully',
      });
    });

    it('5. should prevent escalated trade from being reassigned to payer', async () => {
      const escalatedTrade = [{ ...mockTrades[2], isEscalated: true, status: TradeStatus.ESCALATED }];
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(escalatedTrade);
      mockTradeRepo.find.mockResolvedValue(escalatedTrade);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find.mockResolvedValue(escalatedTrade);

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
        }),
      );
      expect(result).toEqual([]);
    });

    it('6. should mark trade as paid', async () => {
      const trade = { ...mockTrades[0], accountId: 'account1' };
      const bank = { ...mockBanks[0], funds: 1000, logs: [] };
      const shift = { ...mockShifts[0] };

      mockTradeRepo.findOne.mockResolvedValue(trade);
      mockShiftRepo.findOne.mockResolvedValue(shift);
      mockBankRepo.findOne.mockResolvedValue(bank);
      mockPlatformServices.paxful[0].markTradeAsPaid.mockResolvedValue(true);
      mockTradeRepo.save.mockResolvedValue({ ...trade, status: TradeStatus.COMPLETED, completedAt: new Date() });
      mockBankRepo.save.mockResolvedValue(bank);

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      const req = createMockRequest({ tradeId: 'trade1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.markTradeAsPaid(req as Request, res as Response, next);

      expect(mockTradeRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'trade1' },
        relations: ['assignedPayer'],
      });
      expect(mockPlatformServices.paxful[0].markTradeAsPaid).toHaveBeenCalledWith('hash1');
      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          status: TradeStatus.COMPLETED,
        }),
      );
      expect(mockBankRepo.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Trade paid and bank updated successfully',
        data: { trade: expect.any(Object) },
      });
    });

    it('7. should prevent completed trade from being reassigned', async () => {
      const completedTrade = { ...mockTrades[0], status: TradeStatus.COMPLETED };
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue([completedTrade]);
      mockTradeRepo.find.mockResolvedValue([completedTrade]);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find.mockResolvedValue([completedTrade]);

      jest.spyOn(tradeController, 'initializePlatformServices').mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          status: TradeStatus.ASSIGNED,
        }),
      );
      expect(result).toEqual([]);

      mockTradeRepo.findOne.mockResolvedValue(completedTrade);
      const req = createMockRequest({ tradeId: 'trade1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('This trade cannot be reassigned');
    });

    it('8. should reassign trade to free payer or queue if no payers available', async () => {
      const trade = { ...mockTrades[2] };

      // Case 1: Free payer available
      mockTradeRepo.findOne
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...trade, status: TradeStatus.ASSIGNED, assignedPayerId: 'payer1' });
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
      });

      let req = createMockRequest({ tradeId: 'trade3' });
      let res = createMockResponse();
      let next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);

      // Case 2: No free payers
      mockTradeRepo.findOne
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce({ ...mockTrades[1], assignedPayerId: 'payer1' })
        .mockResolvedValueOnce(trade);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        status: TradeStatus.ACTIVE_FUNDED,
        assignedPayerId: 'payer1',
      });

      req = createMockRequest({ tradeId: 'trade3' });
      res = createMockResponse();
      next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ACTIVE_FUNDED,
          assignedPayerId: 'payer1',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('9. should assign queued reassigned trade before newer trades', async () => {
      const activeTrades = [
        { ...mockTrades[2], assignedPayerId: 'payer1', tradeStatus: 'active funded' }, // trade3, reassigned
        { ...mockTrades[3], tradeStatus: 'active funded' }, // trade4, newer
      ];
      const availablePayers = [mockUsers[0]];

      // Reassign trade3 to queue
      mockTradeRepo.findOne
        .mockResolvedValueOnce(mockTrades[2])
        .mockResolvedValueOnce({ ...mockTrades[1], assignedPayerId: 'payer1' })
        .mockResolvedValueOnce(mockTrades[2]);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockTradeRepo.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ACTIVE_FUNDED,
        assignedPayerId: 'payer1',
      });

      const req = createMockRequest({ tradeId: 'trade3' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      // Now assign trades
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(activeTrades);
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ACTIVE_FUNDED,
        assignedPayerId: 'payer1',
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
      });

      jest.spyOn(tradeController, 'initializePlatformServices').mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        }),
      );
      expect(result[0].id).toBe('trade3');
    });

    it('10. should not push out assigned trade for new or reassigned trades', async () => {
      const activeTrades = [mockTrades[2], mockTrades[3]];
      const assignedTrade = { ...mockTrades[0] };
      const availablePayers = [mockUsers[0], mockUsers[1]];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(activeTrades);
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find.mockResolvedValue([assignedTrade]);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockTrades[2]);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer2',
        assignedAt: new Date(),
      });

      jest.spyOn(tradeController, 'initializePlatformServices').mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          status: expect.anything(),
          assignedPayerId: expect.anything(),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].assignedPayerId).toBe('payer2');
    });
  });

  describe('markTradeAsPaid', () => {

    it('should handle trade not found', async () => {
      mockTradeRepo.findOne.mockResolvedValue(null);

      const req = createMockRequest({ tradeId: 'nonexistent' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.markTradeAsPaid(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0] as Error & { statusCode?: number };
      expect(error.message).toBe('Trade not found');
      expect(error.statusCode).toBe(404);
    });

    it('should handle missing trade ID', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.markTradeAsPaid(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0] as Error & { statusCode?: number };
      expect(error.message).toBe('Trade ID is required');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('escalateTrade', () => {
    it('should escalate trade successfully', async () => {
      const trade = { ...mockTrades[0] };
      const ccAgent = mockUsers[2];

      mockTradeRepo.findOne.mockResolvedValue(trade);
      mockUserRepo.findOne.mockResolvedValue(ccAgent);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        isEscalated: true,
        status: TradeStatus.ESCALATED,
        assignedPayerId: null,
        escalationReason: 'Payment issue',
        escalatedById: 'payer1',
      });

      const req = createMockRequest({ tradeId: 'trade1' }, { reason: 'Payment issue', escalatedById: 'payer1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.escalateTrade(req as Request, res as Response, next);

      expect(mockTradeRepo.findOne).toHaveBeenCalledWith({ where: { id: 'trade1' } });
      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isEscalated: true,
          status: TradeStatus.ESCALATED,
          escalationReason: 'Payment issue',
          escalatedById: 'payer1',
          assignedPayerId: null,
        }),
      );
      expect(mockIo.emit).toHaveBeenCalledWith('tradeEscalated', { tradeId: 'trade1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Trade escalated successfully',
      });
    });

    it('should handle trade not found for escalation', async () => {
      mockTradeRepo.findOne.mockResolvedValue(null);

      const req = createMockRequest({ tradeId: 'nonexistent' }, { reason: 'Test reason' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.escalateTrade(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0] as Error;
      expect(error.message).toBe('Trade not found');
    });
  });

  describe('reassignTrade', () => {
    it('should reassign trade to next available payer', async () => {
      const trade = { ...mockTrades[1] };
      const availablePayers = [mockUsers[0], mockUsers[1]];

      mockTradeRepo.findOne
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...trade,
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
          isEscalated: false,
        });
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue(mockShifts);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        isEscalated: false,
      });

      const req = createMockRequest({ tradeId: 'trade2' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Trade reassigned successfully',
        data: expect.any(Object),
      });
    });

    it('should handle no available payers', async () => {
      const trade = { ...mockTrades[1] };

      mockTradeRepo.findOne.mockResolvedValue(trade);
      mockUserRepo.find.mockResolvedValue([]);
      mockShiftRepo.find.mockResolvedValue([]);

      const req = createMockRequest({ tradeId: 'trade2' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0] as Error & { statusCode?: number };
      expect(error.message).toBe('No available payers');
      expect(error.statusCode).toBe(400);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle completed trades', async () => {
      const completedTrade = { ...mockTrades[0], status: TradeStatus.COMPLETED };

      mockTradeRepo.findOne.mockResolvedValue(completedTrade);

      const req = createMockRequest({ tradeId: 'trade1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0] as Error & { statusCode?: number };
      expect(error.message).toBe('This trade cannot be reassigned');
      expect(error.statusCode).toBe(400);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('assignLiveTradesInternal', () => {
    it('should assign trades to available payers', async () => {
      const activeTrades = [{ ...mockTrades[2], tradeStatus: 'active funded', accountId: 'account1' }];
      const availablePayers = [{ ...mockUsers[0], id: 'payer1', clockedIn: true }];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(activeTrades.map((t) => ({ ...t, id: t.id, tradeHash: t.tradeHash })));
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue(mockShifts);
      mockQueryRunner.manager.find.mockResolvedValue([]);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...activeTrades[0],
        id: 'trade3',
        tradeHash: 'hash3',
        status: TradeStatus.ACTIVE_FUNDED,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...activeTrades[0],
        id: 'trade3',
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
      });

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].assignedPayerId).toBe('payer1');
    });

    it('should handle empty trade list', async () => {
      mockTradeRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.find.mockResolvedValue([]);

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      const result = await tradeController.assignLiveTradesInternal();

      expect(result).toEqual([]);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockTradeRepo.find.mockRejectedValue(new Error('Database error'));

      (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

      await expect(tradeController.assignLiveTradesInternal()).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

});