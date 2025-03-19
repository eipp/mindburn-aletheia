// Export types
export * from './types/core';
export * from './utils/ton';

// Export config validators
export {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator,
  // Schemas
  baseTaskSchema,
  verificationTaskSchema,
  workerTaskSchema,
  baseVerificationResultSchema,
  workerVerificationSchema,
  workerProfileSchema,
  transactionSchema,
  paymentResultSchema,
  // Validation helpers
  validateTask,
  validateVerificationTask,
  validateWorkerTask,
  validateWorkerProfile,
  validateTransaction,
  validatePaymentResult,
} from './config/validator';

// Export services
export {
  createTonService,
  TonService,
  type ILogger,
  type NetworkConfig,
  type WalletConfig,
  type PaymentContractInterface,
  type SignedMessage,
  type TransactionHistoryItem,
} from './services/ton';

export {
  createDynamoDBService,
  DynamoDBService,
} from './services/dynamodb';

export {
  createRedisCache,
  RedisCache,
  type RedisCacheOptions,
} from './services/redis';

export {
  createVerificationService,
  VerificationService,
  VerificationOutcome,
  type VerificationAggregationResult,
  type VerificationOptions,
} from './services/verification';

// Export logging utilities
export {
  createLogger,
  logger as defaultLogger,
  LogLevel,
  type LoggerOptions,
  type LogContext,
  type CloudWatchOptions,
} from './utils/logging/logger';

// Export utility functions
export { default as utils } from './utils';

// Common factory function to create all services with one call
export function createServices({
  region,
  credentials,
  tonEndpoint,
  tonApiKey,
  tonNetwork = 'mainnet',
  tablePrefix = '',
  loggerOptions = {},
  redisUrl,
}: {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  tonEndpoint: string;
  tonApiKey?: string;
  tonNetwork?: 'mainnet' | 'testnet';
  tablePrefix?: string;
  loggerOptions?: Partial<LoggerOptions>;
  redisUrl?: string;
}) {
  // Create logger
  const logger = createLogger(loggerOptions);
  
  // Create TON service
  const tonService = createTonService(
    {
      endpoint: tonEndpoint,
      apiKey: tonApiKey,
      network: tonNetwork,
    },
    logger
  );
  
  // Create DynamoDB service
  const dynamoDBService = createDynamoDBService({
    region,
    credentials,
    tablePrefix,
    logger,
  });
  
  // Create Verification service
  const verificationService = createVerificationService(
    dynamoDBService,
    logger
  );
  
  // Create Redis cache service if URL is provided
  const redisCache = redisUrl ? createRedisCache({
    url: redisUrl,
    logger,
  }) : null;
  
  return {
    logger,
    tonService,
    dynamoDBService,
    verificationService,
    redisCache,
  };
}
