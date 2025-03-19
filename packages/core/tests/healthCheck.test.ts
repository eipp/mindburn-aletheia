import { healthCheck, HealthChecker, HealthStatus } from '../src';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { TonService } from '@mindburn/shared';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      Table: {
        TableName: 'test-table',
        TableStatus: 'ACTIVE',
      },
    });
  });

  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
      config: {
        region: () => 'us-east-1',
      },
    })),
    DescribeTableCommand: jest.fn().mockImplementation((params) => params),
  };
});

// Mock @mindburn/shared
jest.mock('@mindburn/shared', () => {
  return {
    createLogger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
    createTonService: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
      networkConfig: {
        network: 'testnet',
      },
    })),
    LogLevel: {
      INFO: 'info',
    },
  };
});

describe('Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    test('should return healthy status with no options', async () => {
      const result = await healthCheck();
      
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('timestamp');
      expect(result.services).toEqual({});
    });

    test('should check DynamoDB status when client is provided', async () => {
      const mockClient = new DynamoDBClient({});
      const result = await healthCheck({
        dynamoDbClient: mockClient,
        tableName: 'test-table',
      });
      
      expect(result).toHaveProperty('status', 'healthy');
      expect(result.services).toHaveProperty('database');
      expect(result.services.database).toHaveProperty('status', 'healthy');
      expect(result.services.database).toHaveProperty('latency');
      
      // Verify DynamoDB client was called with correct params
      expect(DescribeTableCommand).toHaveBeenCalledWith({ TableName: 'test-table' });
    });

    test('should check TON network status when endpoint is provided', async () => {
      const result = await healthCheck({
        tonEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        tonNetwork: 'testnet',
      });
      
      expect(result).toHaveProperty('status', 'healthy');
      expect(result.services).toHaveProperty('tonNetwork');
      expect(result.services.tonNetwork).toHaveProperty('status', 'healthy');
      expect(result.services.tonNetwork).toHaveProperty('latency');
      expect(result.services.tonNetwork).toHaveProperty('network', 'testnet');
    });
  });

  describe('HealthChecker', () => {
    test('should check all services when configured properly', async () => {
      const mockClient = new DynamoDBClient({});
      const mockTonService = {
        getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
        networkConfig: {
          network: 'testnet',
        },
      } as unknown as TonService;
      
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
      
      const healthChecker = new HealthChecker({
        dynamoDbConfig: {
          client: mockClient,
          tableName: 'test-table',
          region: 'us-east-1',
        },
        tonConfig: {
          service: mockTonService,
          endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
          network: 'testnet',
        },
        timeout: 1000,
        logger,
      }, '0.1.0');
      
      const result = await healthChecker.check();
      
      expect(result).toHaveProperty('status', 'healthy');
      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('tonNetwork');
      expect(result.services.database?.status).toBe('healthy');
      expect(result.services.tonNetwork?.status).toBe('healthy');
    });

    test('should handle service errors properly', async () => {
      // Mock the database client to throw an error
      const mockClient = {
        send: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        config: {
          region: () => 'us-east-1',
        },
      } as unknown as DynamoDBClient;
      
      const mockTonService = {
        getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
        networkConfig: {
          network: 'testnet',
        },
      } as unknown as TonService;
      
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
      
      const healthChecker = new HealthChecker({
        dynamoDbConfig: {
          client: mockClient,
          tableName: 'test-table',
          region: 'us-east-1',
        },
        tonConfig: {
          service: mockTonService,
          endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
          network: 'testnet',
        },
        timeout: 1000,
        logger,
      }, '0.1.0');
      
      const result = await healthChecker.check();
      
      expect(result).toHaveProperty('status', 'unhealthy');
      expect(result.services.database?.status).toBe('unhealthy');
      expect(result.services.database?.message).toContain('Database connection failed');
      expect(result.services.tonNetwork?.status).toBe('healthy');
    });
  });
}); 