import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { mockDbConnect, mockQueryRunner, mockIo, mockPlatformServices } from './setup';
import * as tradeController from '../src/controllers/tradeController';
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
    platform: TradePlatform.PAXFUL,
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
    platform: TradePlatform.PAXFUL,
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

    // Setup platform services mock for Paxful and Noones only
    mockPlatformServices.paxful = [
      {
        accountId: 'account1',
        markTradeAsPaid: jest.fn().mockResolvedValue(true),
        listActiveTrades: jest.fn().mockResolvedValue([]),
      },
    ];
    mockPlatformServices.noones = [];
    mockPlatformServices.binance = [];

    // Mock the initializePlatformServices function
    (tradeController.initializePlatformServices as jest.Mock).mockResolvedValue(mockPlatformServices);

    mockDbConnect.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

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
      find: jest.fn().mockResolvedValue(mockAccounts),
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
          return mockTradeRepo;
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
      const activeTrades = [
        {
          trade_hash: 'hash4',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T06:00:00.000Z',
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
          crypto_current_rate_usd: 45000,
        },
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
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
          crypto_current_rate_usd: 45000,
        },
      ];

      const availablePayers = [mockUsers[0]];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);

      const existingDbTrades = [
        {
          id: 'trade4',
          tradeHash: 'hash4',
          status: TradeStatus.ACTIVE_FUNDED,
          assignedPayerId: null,
          isEscalated: false,
          platform: TradePlatform.PAXFUL,
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
          platform: TradePlatform.PAXFUL,
          accountId: 'account1',
          amount: 75,
          platformCreatedAt: new Date('2025-05-01T07:00:00.000Z'),
        },
      ];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(existingDbTrades) // For upsertLiveTrades
        .mockResolvedValueOnce([]); // For processTradeQueue (no assigned trades initially)

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(existingDbTrades[0]) // trade4
        .mockResolvedValueOnce(existingDbTrades[1]); // trade3

      const savedTrade = {
        ...existingDbTrades[0],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
        queuePosition: null,
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedTrade);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade4',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        })
      );
      expect(result).toHaveLength(0); // Function returns empty array
    });

    it('2. should queue trades if all payers are busy', async () => {
      const activeTrades = [
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
        {
          trade_hash: 'hash4',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T06:00:00.000Z',
          fiat_amount_requested: 200,
        },
      ];

      const availablePayers = [mockUsers[0]];
      const assignedTrades = [{ id: 'trade1', assignedPayerId: 'payer1', status: TradeStatus.ASSIGNED }];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(mockTrades.slice(2));
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockTrades.slice(2)) // upsertLiveTrades
        .mockResolvedValueOnce(assignedTrades); // processTradeQueue

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: TradeStatus.ASSIGNED })
      );
      expect(result).toEqual([]);
    });

    it('3. should assign queued trades to free payer with oldest first', async () => {
      const activeTrades = [
        {
          trade_hash: 'hash4',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T06:00:00.000Z',
          fiat_amount_requested: 200,
        },
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
      ];

      const availablePayers = [mockUsers[0], mockUsers[1]];

      // First call: all payers busy
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValueOnce(mockTrades.slice(2).reverse());
      mockUserRepo.find.mockResolvedValueOnce(availablePayers);
      mockShiftRepo.find.mockResolvedValueOnce([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        { id: 'trade1', assignedPayerId: 'payer1', status: TradeStatus.ASSIGNED },
        { id: 'trade2', assignedPayerId: 'payer2', status: TradeStatus.ASSIGNED },
      ]);
      await tradeController.assignLiveTradesInternal();

      // Second call: one payer free
      mockTradeRepo.find.mockResolvedValueOnce(mockTrades.slice(2).reverse());
      mockUserRepo.find.mockResolvedValueOnce(availablePayers);
      mockShiftRepo.find.mockResolvedValueOnce([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockTrades[3]);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[3],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
        queuePosition: null,
      });

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade4',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        })
      );
      expect(result).toEqual([]);
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
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith('tradeEscalated', { tradeId: 'trade1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Trade escalated successfully',
      });
    });

    it('5. should prevent escalated trade from being reassigned to payer', async () => {
      const escalatedTrade = [
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
      ];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(escalatedTrade);
      mockTradeRepo.find.mockResolvedValue([{ ...mockTrades[2], isEscalated: true, status: TradeStatus.ESCALATED }]);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...mockTrades[2], isEscalated: true, status: TradeStatus.ESCALATED }])
        .mockResolvedValueOnce([]);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
        })
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
        })
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
      const completedTrade = [
        {
          trade_hash: 'hash1',
          trade_status: 'completed',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T08:00:00.000Z',
          fiat_amount_requested: 100,
        },
      ];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(completedTrade);
      mockTradeRepo.find.mockResolvedValue([{ ...mockTrades[0], status: TradeStatus.COMPLETED }]);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ ...mockTrades[0], status: TradeStatus.COMPLETED }])
        .mockResolvedValueOnce([]);

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          status: TradeStatus.ASSIGNED,
        })
      );
      expect(result).toEqual([]);

      mockTradeRepo.findOne.mockResolvedValue({ ...mockTrades[0], status: TradeStatus.COMPLETED });
      const req = createMockRequest({ tradeId: 'trade1' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('This trade was cancelled and cannot be reassigned');
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
        queuePosition: null,
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
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);

      // Case 2: No free payers
      mockTradeRepo.findOne
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce({ id: 'trade1', assignedPayerId: 'payer1', status: TradeStatus.ASSIGNED })
        .mockResolvedValueOnce(trade);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockTradeRepo.save.mockResolvedValue({
        ...trade,
        status: TradeStatus.ACTIVE_FUNDED,
        assignedPayerId: undefined,
        queuePosition: 2,
      });

      req = createMockRequest({ tradeId: 'trade3' });
      res = createMockResponse();
      next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ACTIVE_FUNDED,
          assignedPayerId: undefined,
          queuePosition: 2,
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('9. should assign queued reassigned trade before newer trades', async () => {
      const activeTrades = [
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
        {
          trade_hash: 'hash4',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T06:00:00.000Z',
          fiat_amount_requested: 200,
        },
      ];

      const availablePayers = [mockUsers[0]];

      // Reassign trade3
      mockTradeRepo.findOne
        .mockResolvedValueOnce(mockTrades[2])
        .mockResolvedValueOnce({ id: 'trade1', assignedPayerId: 'payer1', status: TradeStatus.ASSIGNED })
        .mockResolvedValueOnce(mockTrades[2]);
      mockUserRepo.find.mockResolvedValue([mockUsers[0]]);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockTradeRepo.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ACTIVE_FUNDED,
        assignedPayerId: undefined,
        queuePosition: 2,
      });

      const req = createMockRequest({ tradeId: 'trade3' });
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.reassignTrade(req as Request, res as Response, next);

      // Assign trades
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(mockTrades.slice(2));
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockTrades.slice(2))
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockTrades[3], // trade4 is older
        status: TradeStatus.ACTIVE_FUNDED,
      });
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[3],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
        queuePosition: null,
      });

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade4', // Oldest trade should be assigned
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        })
      );
      expect(result).toEqual([]);
    });

    it('10. should not push out assigned trade for new or reassigned trades', async () => {
      const activeTrades = [
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
        {
          trade_hash: 'hash4',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T06:00:00.000Z',
          fiat_amount_requested: 200,
        },
      ];

      const assignedTrade = { ...mockTrades[0] };
      const availablePayers = [mockUsers[0], mockUsers[1]];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue(mockTrades.slice(2));
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0], mockShifts[1]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce(mockTrades.slice(2))
        .mockResolvedValueOnce([assignedTrade]);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockTrades[2]);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer2',
        assignedAt: new Date(),
        queuePosition: null,
      });

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade1',
          status: expect.anything(),
          assignedPayerId: expect.anything(),
        })
      );
      expect(result).toEqual([]);
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
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Trade not found');
      expect(error.statusCode).toBe(404);
    });

    it('should handle missing trade ID', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      await tradeController.markTradeAsPaid(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = (next as jest.Mock).mock.calls[0][0];
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
        })
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
      const error = (next as jest.Mock).mock.calls[0][0];
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
        queuePosition: null,
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
      const error = (next as jest.Mock).mock.calls[0][0];
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
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('This trade was cancelled and cannot be reassigned');
      expect(error.statusCode).toBe(400);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('assignLiveTradesInternal', () => {
    it('should assign trades to available payers', async () => {
      const activeTrades = [
        {
          trade_hash: 'hash3',
          trade_status: 'active funded',
          accountId: 'account1',
          platform: 'paxful',
          started_at: '2025-05-01T07:00:00.000Z',
          fiat_amount_requested: 75,
        },
      ];
      const availablePayers = [mockUsers[0]];

      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue(activeTrades);
      mockTradeRepo.find.mockResolvedValue([mockTrades[2]]);
      mockUserRepo.find.mockResolvedValue(availablePayers);
      mockShiftRepo.find.mockResolvedValue([mockShifts[0]]);
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([mockTrades[2]])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockTrades[2]);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockTrades[2],
        status: TradeStatus.ASSIGNED,
        assignedPayerId: 'payer1',
        assignedAt: new Date(),
        queuePosition: null,
      });

      const result = await tradeController.assignLiveTradesInternal();

      expect(mockTradeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'trade3',
          status: TradeStatus.ASSIGNED,
          assignedPayerId: 'payer1',
        })
      );
      expect(result).toEqual([]);
    });

    it('should handle empty trade list', async () => {
      mockPlatformServices.paxful[0].listActiveTrades.mockResolvedValue([]);
      mockTradeRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.find.mockResolvedValue([]);

      const result = await tradeController.assignLiveTradesInternal();

      expect(result).toEqual([]);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockTradeRepo.find.mockRejectedValue(new Error('Database error'));

      await expect(tradeController.assignLiveTradesInternal()).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});