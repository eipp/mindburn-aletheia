import {
  StorageService,
  QueueService,
  LoggerService,
  AIService,
  MetricsService,
  EventBus,
  DashboardService,
} from '@mindburn/shared';

// Mock shared services
jest.mock('@mindburn/shared', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    put: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    query: jest.fn(),
  })),
  QueueService: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    receive: jest.fn(),
    delete: jest.fn(),
    purge: jest.fn(),
  })),
  LoggerService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  AIService: jest.fn().mockImplementation(() => ({
    verifyText: jest.fn(),
    verifyImageText: jest.fn(),
    assessSourceCredibility: jest.fn(),
  })),
  MetricsService: jest.fn().mockImplementation(() => ({
    gauge: jest.fn(),
    counter: jest.fn(),
    histogram: jest.fn(),
    getMetric: jest.fn(),
  })),
  EventBus: jest.fn().mockImplementation(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
  DashboardService: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test',
};
