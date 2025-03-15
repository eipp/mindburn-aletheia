import { z } from 'zod';

export const ModelRegistryConfigSchema = z.object({
  dynamoTable: z.string(),
  s3Bucket: z.string(),
  kmsKeyId: z.string(),
  region: z.string(),
  environment: z.string(),
  modelTypes: z.array(z.string()),
  allowedProviders: z.array(z.string()),
  modelStatuses: z.array(z.string()),
  requiredPerformanceMetrics: z.array(z.string()),
  auditFrequencyDays: z.number().min(1),
  retentionPeriodDays: z.number().min(1),
  maxVersionsPerModel: z.number().min(1),
  approvalWorkflowEnabled: z.boolean(),
  requiredApprovers: z.number().min(1).optional(),
  autoPromoteToProduction: z.boolean(),
  productionSafetyChecks: z.array(z.string()),
  loggingLevel: z.enum(['debug', 'info', 'warn', 'error']),
  alertingEnabled: z.boolean(),
  alertingThresholds: z.object({
    errorRate: z.number(),
    latency: z.number(),
    driftThreshold: z.number(),
  }),
  complianceSettings: z.object({
    dataRetentionEnabled: z.boolean(),
    auditTrailRequired: z.boolean(),
    encryptionRequired: z.boolean(),
    accessControlRequired: z.boolean(),
  }),
  performanceMonitoring: z.object({
    enabled: z.boolean(),
    metricCollectionInterval: z.number(),
    baselineMetrics: z.array(z.string()),
  }),
  securitySettings: z.object({
    encryptionAtRest: z.boolean(),
    encryptionInTransit: z.boolean(),
    accessLogging: z.boolean(),
    ipRestrictions: z.array(z.string()).optional(),
  }),
});

export type ModelRegistryConfig = z.infer<typeof ModelRegistryConfigSchema>;

export const defaultConfig: ModelRegistryConfig = {
  dynamoTable: 'model-registry',
  s3Bucket: 'model-artifacts',
  kmsKeyId: '',
  region: 'us-east-1',
  environment: 'development',
  modelTypes: ['classification', 'regression', 'nlp', 'vision'],
  allowedProviders: ['openai', 'anthropic', 'cohere', 'internal'],
  modelStatuses: ['draft', 'testing', 'staging', 'production', 'deprecated'],
  requiredPerformanceMetrics: ['accuracy', 'latency', 'errorRate'],
  auditFrequencyDays: 30,
  retentionPeriodDays: 365,
  maxVersionsPerModel: 10,
  approvalWorkflowEnabled: true,
  requiredApprovers: 2,
  autoPromoteToProduction: false,
  productionSafetyChecks: [
    'performance_validation',
    'security_scan',
    'bias_check',
    'compliance_check',
  ],
  loggingLevel: 'info',
  alertingEnabled: true,
  alertingThresholds: {
    errorRate: 0.01,
    latency: 1000,
    driftThreshold: 0.1,
  },
  complianceSettings: {
    dataRetentionEnabled: true,
    auditTrailRequired: true,
    encryptionRequired: true,
    accessControlRequired: true,
  },
  performanceMonitoring: {
    enabled: true,
    metricCollectionInterval: 300,
    baselineMetrics: [
      'requests_per_second',
      'error_rate',
      'latency_p95',
      'memory_usage',
    ],
  },
  securitySettings: {
    encryptionAtRest: true,
    encryptionInTransit: true,
    accessLogging: true,
    ipRestrictions: [],
  },
};

export function validateConfig(config: Partial<ModelRegistryConfig>): ModelRegistryConfig {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
  };
  return ModelRegistryConfigSchema.parse(mergedConfig);
}

export function getEnvironmentConfig(): ModelRegistryConfig {
  const envConfig: Partial<ModelRegistryConfig> = {
    dynamoTable: process.env.MODEL_REGISTRY_TABLE || defaultConfig.dynamoTable,
    s3Bucket: process.env.MODEL_ARTIFACTS_BUCKET || defaultConfig.s3Bucket,
    kmsKeyId: process.env.KMS_KEY_ID || defaultConfig.kmsKeyId,
    region: process.env.AWS_REGION || defaultConfig.region,
    environment: process.env.NODE_ENV || defaultConfig.environment,
    loggingLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || defaultConfig.loggingLevel,
    approvalWorkflowEnabled: process.env.APPROVAL_WORKFLOW_ENABLED === 'true',
    autoPromoteToProduction: process.env.AUTO_PROMOTE_TO_PRODUCTION === 'true',
  };

  return validateConfig(envConfig);
} 