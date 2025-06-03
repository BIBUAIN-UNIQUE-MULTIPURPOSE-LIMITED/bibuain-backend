import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';

// Define types for platform services
interface PlatformService {
  markTradeAsPaid: jest.Mock;
  listActiveTrades: jest.Mock;
  accountId?: string;
  label?: string;
}

interface PlatformServices {
  paxful: PlatformService[];
  noones: PlatformService[];
  binance: PlatformService[];
}

// Mock query runner
const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined as never),
  startTransaction: jest.fn().mockResolvedValue(undefined as never),
  commitTransaction: jest.fn().mockResolvedValue(undefined as never),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined as never),
  release: jest.fn().mockResolvedValue(undefined as never),
  manager: {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getRepository: jest.fn(),
  },
};

// Mock database connection object
const mockDbConnect = {
  initialize: jest.fn().mockResolvedValue(undefined as never),
  isInitialized: true,
  connect: jest.fn().mockResolvedValue(undefined as never),
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  getRepository: jest.fn(),
  destroy: jest.fn().mockResolvedValue(undefined as never),
  query: jest.fn().mockResolvedValue([{"1": 1}] as never),
};

// Mock Socket.IO
const mockIo = {
  emit: jest.fn(),
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
};

// Mock platform services
const mockPlatformServices: PlatformServices = {
  paxful: [{
    markTradeAsPaid: jest.fn().mockResolvedValue(true as never),
    listActiveTrades: jest.fn().mockResolvedValue([] as never),
    accountId: 'account1',
    label: 'paxful-account',
  }],
  noones: [],
  binance: [],
};

// Export mocks for use in tests
export { mockDbConnect, mockQueryRunner, mockIo, mockPlatformServices };

// Mock the database module
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: mockDbConnect,
}));

// Mock Socket.IO server
jest.mock('../src/server', () => ({
  io: mockIo,
}));

// Mock entity classes - UPDATED TO INCLUDE TradePlatform
jest.mock('../src/models/trades', () => ({
  Trade: class Trade {
    constructor() {}
  },
  TradeStatus: {
    ACTIVE_FUNDED: 'ACTIVE_FUNDED',
    ASSIGNED: 'ASSIGNED',
    ESCALATED: 'ESCALATED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
    SUCCESSFUL: 'SUCCESSFUL',
    PAID: 'PAID',
    COMPLETED: 'COMPLETED',
    DISPUTED: 'DISPUTED',
  },
  TradePlatform: {
    PAXFUL: 'paxful',
    NOONES: 'noones',
    BINANCE: 'binance',
  },
}));

jest.mock('../src/models/user', () => ({
  User: class User {
    constructor() {}
  },
  UserType: {
    ADMIN: 'admin',
    PAYER: 'payer',
    RATER: 'rater',
    CEO: 'ceo',
    CC: 'customer-support',
  },
}));

jest.mock('../src/models/shift', () => ({
  Shift: class Shift {
    constructor() {}
  },
  ShiftStatus: {
    ACTIVE: 'active',
    ON_BREAK: 'on_break',
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ENDED: 'ended',
    FORCE_CLOSED: 'force_closed',
  },
}));

jest.mock('../src/models/accounts', () => ({
  Account: class Account {
    constructor() {}
  },
  ForexPlatform: {
    PAXFUL: 'paxful',
    NOONES: 'noones',
    BINANCE: 'binance',
  },
}));

jest.mock('../src/models/bank', () => ({
  Bank: class Bank {
    constructor() {}
  },
  BankTag: {
    PRIMARY: 'primary',
    ROLLOVER: 'rollover',
  },
}));

jest.mock('../src/models/notifications', () => ({
  NotificationType: {
    SYSTEM: 'system',
  },
  PriorityLevel: {
    HIGH: 'high',
  },
}));

// Mock platform services
jest.mock('../src/config/paxful', () => ({
  PaxfulService: class PaxfulService {
    markTradeAsPaid = jest.fn().mockResolvedValue(true as never);
    listActiveTrades = jest.fn().mockResolvedValue([] as never);
  },
  __esModule: true,
  default: {
    markTradeAsPaid: jest.fn().mockResolvedValue(true as never),
    listActiveTrades: jest.fn().mockResolvedValue([] as never),
  },
}));

jest.mock('../src/config/noones', () => ({
  NoonesService: class NoonesService {
    markTradeAsPaid = jest.fn().mockResolvedValue(true as never);
    listActiveTrades = jest.fn().mockResolvedValue([] as never);
  },
}));

jest.mock('../src/config/binance', () => ({
  BinanceService: class BinanceService {},
}));

// Mock notification controller
jest.mock('../src/controllers/notificationController', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined  as never),
}));

// Mock error handler
jest.mock('../src/utils/errorHandler', () => ({
  __esModule: true,
  default: class ErrorHandler extends Error {
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'ErrorHandler';
      Object.defineProperty(this, 'statusCode', { value: statusCode });
    }
  },
}));

// Mock the app
jest.mock('../src/app', () => {
  const mockApp = {
    get: jest.fn().mockReturnValue(mockIo),
    set: jest.fn(),
  };
  return mockApp;
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_DATABASE = 'test_db';

// Global test setup
beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.clearAllTimers();
});

afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

jest.setTimeout(15000);