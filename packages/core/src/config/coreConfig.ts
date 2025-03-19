import { z } from 'zod';
import { createConfigValidator } from '@mindburn/shared';

export interface CoreConfig {
  app: {
    name: string;
    version: string;
    environment: string;
  };
  aws: {
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    dynamodb: {
      tablePrefix: string;
      healthCheckTable: string;
    };
  };
  ton: {
    endpoint: string;
    apiKey?: string;
    network: 'mainnet' | 'testnet';
  };
  logging: {
    level: string;
    cloudWatch: {
      enabled: boolean;
      logGroupName: string;
      logStreamName: string;
      retentionInDays?: number;
    };
  };
  health: {
    checkInterval: number;
    timeout: number;
  };
}

const coreConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    environment: z.enum(['development', 'test', 'staging', 'production']),
  }),
  aws: z.object({
    region: z.string().min(1),
    credentials: z.object({
      accessKeyId: z.string().min(1),
      secretAccessKey: z.string().min(1),
    }),
    dynamodb: z.object({
      tablePrefix: z.string(),
      healthCheckTable: z.string().min(1),
    }),
  }),
  ton: z.object({
    endpoint: z.string().url(),
    apiKey: z.string().optional(),
    network: z.enum(['mainnet', 'testnet']),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']),
    cloudWatch: z.object({
      enabled: z.boolean(),
      logGroupName: z.string().min(1),
      logStreamName: z.string().min(1),
      retentionInDays: z.number().int().positive().optional(),
    }),
  }),
  health: z.object({
    checkInterval: z.number().int().positive(),
    timeout: z.number().int().positive(),
  }),
});

const defaultConfig: CoreConfig = {
  app: {
    name: 'mindburn-aletheia',
    version: '0.1.0',
    environment: 'development',
  },
  aws: {
    region: 'us-east-1',
    credentials: {
      accessKeyId: '',
      secretAccessKey: '',
    },
    dynamodb: {
      tablePrefix: 'mindburn-',
      healthCheckTable: 'health-check',
    },
  },
  ton: {
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    network: 'testnet',
  },
  logging: {
    level: 'info',
    cloudWatch: {
      enabled: false,
      logGroupName: '/mindburn/aletheia',
      logStreamName: 'core',
      retentionInDays: 30,
    },
  },
  health: {
    checkInterval: 60000, // 1 minute
    timeout: 5000, // 5 seconds
  },
};

export const validateCoreConfig = createConfigValidator<CoreConfig>({
  schema: coreConfigSchema,
  defaultConfig,
});

// Environment variable mapping for core config
export const coreConfigEnvMapping: Record<string, string> = {
  'app.name': 'MINDBURN_APP_NAME',
  'app.version': 'MINDBURN_APP_VERSION',
  'app.environment': 'NODE_ENV',
  'aws.region': 'AWS_REGION',
  'aws.credentials.accessKeyId': 'AWS_ACCESS_KEY_ID',
  'aws.credentials.secretAccessKey': 'AWS_SECRET_ACCESS_KEY',
  'aws.dynamodb.tablePrefix': 'DYNAMODB_TABLE_PREFIX',
  'aws.dynamodb.healthCheckTable': 'DYNAMODB_HEALTH_CHECK_TABLE',
  'ton.endpoint': 'TON_ENDPOINT',
  'ton.apiKey': 'TON_API_KEY',
  'ton.network': 'TON_NETWORK',
  'logging.level': 'LOG_LEVEL',
  'logging.cloudWatch.enabled': 'CLOUDWATCH_ENABLED',
  'logging.cloudWatch.logGroupName': 'CLOUDWATCH_LOG_GROUP',
  'logging.cloudWatch.logStreamName': 'CLOUDWATCH_LOG_STREAM',
  'logging.cloudWatch.retentionInDays': 'CLOUDWATCH_RETENTION_DAYS',
  'health.checkInterval': 'HEALTH_CHECK_INTERVAL',
  'health.timeout': 'HEALTH_CHECK_TIMEOUT',
}; 