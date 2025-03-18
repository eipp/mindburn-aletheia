import { z } from 'zod';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('config');

const ConfigSchema = z.object({
  aws: z.object({
    region: z.string().min(1),
    dynamoTable: z.string().min(1),
  }),
  ton: z.object({
    endpoint: z.string().url(),
    minWalletBalance: z.number().positive(),
    networkType: z.enum(['mainnet', 'testnet']),
  }),
  kyc: z.object({
    apiKey: z.string().min(1),
    apiUrl: z.string().url(),
    provider: z.enum(['sumsub', 'other']),
  }),
  security: z.object({
    fraudDetectionEnabled: z.boolean(),
    maxLoginAttempts: z.number().int().positive(),
    sessionTimeout: z.number().int().positive(),
  }),
  worker: z.object({
    minReputation: z.number().min(0).max(1),
    maxDailyTasks: z.number().int().positive(),
    paymentThreshold: z.number().positive(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  try {
    const config = {
      aws: {
        region: process.env.AWS_REGION!,
        dynamoTable: process.env.DYNAMODB_TABLE!,
      },
      ton: {
        endpoint: process.env.TON_ENDPOINT!,
        minWalletBalance: Number(process.env.MIN_WALLET_BALANCE || '0.1'),
        networkType: process.env.TON_NETWORK || 'mainnet',
      },
      kyc: {
        apiKey: process.env.KYC_API_KEY!,
        apiUrl: process.env.KYC_API_URL!,
        provider: process.env.KYC_PROVIDER || 'sumsub',
      },
      security: {
        fraudDetectionEnabled: process.env.FRAUD_DETECTION_ENABLED !== 'false',
        maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || '3'),
        sessionTimeout: Number(process.env.SESSION_TIMEOUT || '3600'),
      },
      worker: {
        minReputation: Number(process.env.MIN_WORKER_REPUTATION || '0.7'),
        maxDailyTasks: Number(process.env.MAX_DAILY_TASKS || '100'),
        paymentThreshold: Number(process.env.PAYMENT_THRESHOLD || '1.0'),
      },
    };

    return ConfigSchema.parse(config);
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    throw new Error('Invalid configuration. Check environment variables.');
  }
}

export const config = loadConfig(); 