import { z } from 'zod';
import { Logger } from '../utils/Logger';

const FeatureFlagsSchema = z.object({
  enableAdvancedFraudDetection: z.boolean(),
  enableMachineLearning: z.boolean(),
  enableIpIntelligence: z.boolean(),
  enableQualityControl: z.boolean(),
  enableGoldenSet: z.boolean(),
  enablePeerReview: z.boolean(),
  enableRealTimeAlerts: z.boolean(),
});

const ThresholdsSchema = z.object({
  fraud: z.object({
    lowRisk: z.number().min(0).max(1),
    mediumRisk: z.number().min(0).max(1),
    highRisk: z.number().min(0).max(1),
    criticalRisk: z.number().min(0).max(1),
  }),
  quality: z.object({
    minimumScore: z.number().min(0).max(1),
    warningThreshold: z.number().min(0).max(1),
    suspensionThreshold: z.number().min(0).max(1),
  }),
  activity: z.object({
    maxTasksPerHour: z.number().positive(),
    minProcessingTime: z.number().positive(),
    maxProcessingTime: z.number().positive(),
  }),
});

const WeightsSchema = z.object({
  reputationWeight: z.number().min(0).max(1),
  activityWeight: z.number().min(0).max(1),
  networkWeight: z.number().min(0).max(1),
  qualityWeight: z.number().min(0).max(1),
});

const ExternalApisSchema = z.object({
  maxmind: z.object({
    apiKey: z.string(),
    accountId: z.string(),
  }),
  proxycheck: z.object({
    apiKey: z.string(),
  }),
  ipqualityscore: z.object({
    apiKey: z.string(),
  }),
});

const CacheConfigSchema = z.object({
  ipIntelligenceTtl: z.number().positive(),
  mlPredictionTtl: z.number().positive(),
  metricsCacheTtl: z.number().positive(),
});

const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  featureFlags: FeatureFlagsSchema,
  thresholds: ThresholdsSchema,
  weights: WeightsSchema,
  externalApis: ExternalApisSchema,
  cache: CacheConfigSchema,
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

type Config = z.infer<typeof ConfigSchema>;

export class FraudQualityConfig {
  private static instance: FraudQualityConfig;
  private config: Config;
  private readonly logger: Logger;

  private constructor() {
    this.logger = new Logger();
    this.loadConfig();
  }

  static getInstance(): FraudQualityConfig {
    if (!FraudQualityConfig.instance) {
      FraudQualityConfig.instance = new FraudQualityConfig();
    }
    return FraudQualityConfig.instance;
  }

  private loadConfig(): void {
    try {
      const environment = process.env.NODE_ENV || 'development';
      const rawConfig = {
        environment,
        featureFlags: {
          enableAdvancedFraudDetection: this.getBooleanEnv('ENABLE_ADVANCED_FRAUD_DETECTION', true),
          enableMachineLearning: this.getBooleanEnv('ENABLE_MACHINE_LEARNING', true),
          enableIpIntelligence: this.getBooleanEnv('ENABLE_IP_INTELLIGENCE', true),
          enableQualityControl: this.getBooleanEnv('ENABLE_QUALITY_CONTROL', true),
          enableGoldenSet: this.getBooleanEnv('ENABLE_GOLDEN_SET', true),
          enablePeerReview: this.getBooleanEnv('ENABLE_PEER_REVIEW', true),
          enableRealTimeAlerts: this.getBooleanEnv('ENABLE_REAL_TIME_ALERTS', true),
        },
        thresholds: {
          fraud: {
            lowRisk: this.getNumberEnv('FRAUD_LOW_RISK', 0.2),
            mediumRisk: this.getNumberEnv('FRAUD_MEDIUM_RISK', 0.4),
            highRisk: this.getNumberEnv('FRAUD_HIGH_RISK', 0.6),
            criticalRisk: this.getNumberEnv('FRAUD_CRITICAL_RISK', 0.8),
          },
          quality: {
            minimumScore: this.getNumberEnv('QUALITY_MINIMUM_SCORE', 0.7),
            warningThreshold: this.getNumberEnv('QUALITY_WARNING_THRESHOLD', 0.6),
            suspensionThreshold: this.getNumberEnv('QUALITY_SUSPENSION_THRESHOLD', 0.4),
          },
          activity: {
            maxTasksPerHour: this.getNumberEnv('MAX_TASKS_PER_HOUR', 50),
            minProcessingTime: this.getNumberEnv('MIN_PROCESSING_TIME', 5),
            maxProcessingTime: this.getNumberEnv('MAX_PROCESSING_TIME', 300),
          },
        },
        weights: {
          reputationWeight: this.getNumberEnv('REPUTATION_WEIGHT', 0.3),
          activityWeight: this.getNumberEnv('ACTIVITY_WEIGHT', 0.2),
          networkWeight: this.getNumberEnv('NETWORK_WEIGHT', 0.2),
          qualityWeight: this.getNumberEnv('QUALITY_WEIGHT', 0.3),
        },
        externalApis: {
          maxmind: {
            apiKey: process.env.MAXMIND_API_KEY || '',
            accountId: process.env.MAXMIND_ACCOUNT_ID || '',
          },
          proxycheck: {
            apiKey: process.env.PROXYCHECK_API_KEY || '',
          },
          ipqualityscore: {
            apiKey: process.env.IPQUALITYSCORE_API_KEY || '',
          },
        },
        cache: {
          ipIntelligenceTtl: this.getNumberEnv('IP_INTELLIGENCE_TTL', 3600),
          mlPredictionTtl: this.getNumberEnv('ML_PREDICTION_TTL', 1800),
          metricsCacheTtl: this.getNumberEnv('METRICS_CACHE_TTL', 300),
        },
        logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
      };

      this.config = ConfigSchema.parse(rawConfig);
    } catch (error) {
      this.logger.error('Failed to load configuration', { error });
      throw new Error('Configuration validation failed');
    }
  }

  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  private getNumberEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  get<T extends keyof Config>(key: T): Config[T] {
    return this.config[key];
  }

  isFeatureEnabled(feature: keyof typeof FeatureFlagsSchema.shape): boolean {
    return this.config.featureFlags[feature];
  }

  getThreshold(category: keyof typeof ThresholdsSchema.shape, key: string): number {
    return this.config.thresholds[category][key];
  }

  getWeight(key: keyof typeof WeightsSchema.shape): number {
    return this.config.weights[key];
  }

  getApiConfig(provider: keyof typeof ExternalApisSchema.shape): Record<string, string> {
    return this.config.externalApis[provider];
  }

  getCacheTtl(key: keyof typeof CacheConfigSchema.shape): number {
    return this.config.cache[key];
  }

  reloadConfig(): void {
    this.loadConfig();
    this.logger.info('Configuration reloaded');
  }
}
