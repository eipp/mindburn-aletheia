import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator,
} from '@mindburn/shared';

export interface PaymentSystemConfig {
  tonEndpoint: string;
  network: 'mainnet' | 'testnet';
  minWithdrawal: number;
  maxWithdrawal: number;
  apiKey: string;
  webhookUrl?: string;
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
}

const defaultConfig: PaymentSystemConfig = {
  tonEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
  network: 'testnet',
  minWithdrawal: 1,
  maxWithdrawal: 1000,
  apiKey: '',
  retryAttempts: 3,
  retryDelay: 1000,
  batchSize: 50,
};

const PaymentSystemSchema = z.object({
  tonEndpoint: z.string().url(),
  network: z.enum(['mainnet', 'testnet']),
  minWithdrawal: z.number().min(0.1),
  maxWithdrawal: z.number().min(1),
  apiKey: z.string(),
  webhookUrl: z.string().url().optional(),
  retryAttempts: z.number().min(1).max(10),
  retryDelay: z.number().min(100).max(10000),
  batchSize: z.number().min(1).max(100),
});

const envMap: Record<keyof PaymentSystemConfig, string> = {
  tonEndpoint: 'TON_ENDPOINT',
  network: 'TON_NETWORK',
  minWithdrawal: 'MIN_WITHDRAWAL',
  maxWithdrawal: 'MAX_WITHDRAWAL',
  apiKey: 'TON_API_KEY',
  webhookUrl: 'WEBHOOK_URL',
  retryAttempts: 'RETRY_ATTEMPTS',
  retryDelay: 'RETRY_DELAY',
  batchSize: 'BATCH_SIZE',
};

export const validateConfig = createConfigValidator<PaymentSystemConfig>({
  schema: PaymentSystemSchema,
  defaultConfig,
  transformers: [createEnvironmentTransformer(envMap)],
  validators: [
    createSecurityValidator(['apiKey']),
    createPerformanceValidator({
      batchSize: 50,
      retryDelay: 5000,
    }),
  ],
});

export function getConfig(): PaymentSystemConfig {
  return validateConfig({});
}
