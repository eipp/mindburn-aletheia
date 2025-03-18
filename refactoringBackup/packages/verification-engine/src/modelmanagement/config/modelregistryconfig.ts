import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator
} from '@mindburn/shared';

export interface ModelRegistryConfig {
  dynamoTable: string;
  s3Bucket: string;
  kmsKeyId?: string;
  region: string;
  environment: 'development' | 'staging' | 'production';
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  approvalWorkflowEnabled: boolean;
  autoPromoteToProduction: boolean;
  retentionDays: number;
  maxModelSize: number;
  maxConcurrentDeployments: number;
}

const defaultConfig: ModelRegistryConfig = {
  dynamoTable: 'model-registry',
  s3Bucket: 'model-artifacts',
  region: 'us-east-1',
  environment: 'development',
  loggingLevel: 'info',
  approvalWorkflowEnabled: false,
  autoPromoteToProduction: false,
  retentionDays: 30,
  maxModelSize: 1024 * 1024 * 1024, // 1GB
  maxConcurrentDeployments: 5
};

const ModelRegistrySchema = z.object({
  dynamoTable: z.string(),
  s3Bucket: z.string(),
  kmsKeyId: z.string().optional(),
  region: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  loggingLevel: z.enum(['debug', 'info', 'warn', 'error']),
  approvalWorkflowEnabled: z.boolean(),
  autoPromoteToProduction: z.boolean(),
  retentionDays: z.number().min(1).max(365),
  maxModelSize: z.number().min(1024 * 1024), // Min 1MB
  maxConcurrentDeployments: z.number().min(1).max(20)
});

const envMap: Record<keyof ModelRegistryConfig, string> = {
  dynamoTable: 'MODEL_REGISTRY_TABLE',
  s3Bucket: 'MODEL_ARTIFACTS_BUCKET',
  kmsKeyId: 'MODEL_KMS_KEY_ID',
  region: 'AWS_REGION',
  environment: 'NODE_ENV',
  loggingLevel: 'LOG_LEVEL',
  approvalWorkflowEnabled: 'APPROVAL_WORKFLOW_ENABLED',
  autoPromoteToProduction: 'AUTO_PROMOTE_TO_PROD',
  retentionDays: 'MODEL_RETENTION_DAYS',
  maxModelSize: 'MAX_MODEL_SIZE',
  maxConcurrentDeployments: 'MAX_CONCURRENT_DEPLOYMENTS'
};

export const validateConfig = createConfigValidator<ModelRegistryConfig>({
  schema: ModelRegistrySchema,
  defaultConfig,
  transformers: [
    createEnvironmentTransformer(envMap)
  ],
  validators: [
    createSecurityValidator(['kmsKeyId']),
    createPerformanceValidator({
      maxConcurrentDeployments: 10,
      maxModelSize: 5 * 1024 * 1024 * 1024 // 5GB
    })
  ]
});

export function getConfig(): ModelRegistryConfig {
  return validateConfig({});
} 