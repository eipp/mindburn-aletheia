import { DynamoDB } from 'aws-sdk';
import { ModelMetadata } from '../model-management/model-registry';
import { ApprovalStage } from '../model-management/config/approval-workflow-config';
import { MetricConfig } from '../model-management/config/monitoring-config';

export function createMockModelMetadata(overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    modelId: 'test-model-1',
    version: '1.0.0',
    name: 'Test Model',
    type: 'classification',
    provider: 'openai',
    status: 'draft',
    trainingData: {
      source: 'test-dataset',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    performance: {
      accuracy: 0.95,
      latency: 100,
      errorRate: 0.02,
    },
    governance: {
      approvers: ['user1', 'user2'],
      lastAuditDate: new Date().toISOString(),
      complianceStatus: 'compliant',
    },
    changelog: [
      {
        version: '1.0.0',
        changes: ['Initial release'],
        author: 'test-user',
        timestamp: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

export function createMockApprovalStage(overrides: Partial<ApprovalStage> = {}): ApprovalStage {
  return {
    name: 'test-stage',
    requiredApprovers: 2,
    autoTransition: false,
    timeoutHours: 24,
    requiredChecks: ['test-check-1', 'test-check-2'],
    notificationTargets: ['test-team'],
    approverRoles: ['test-role'],
    ...overrides,
  };
}

export function createMockMetricConfig(overrides: Partial<MetricConfig> = {}): MetricConfig {
  return {
    name: 'test-metric',
    description: 'Test metric description',
    unit: 'count',
    aggregation: 'avg',
    thresholds: {
      warning: 10,
      critical: 20,
      comparisonOperator: '>',
    },
    evaluationPeriod: 300,
    evaluationFrequency: 60,
    ...overrides,
  };
}

export function createMockDynamoDBItem(data: Record<string, any>): Record<string, DynamoDB.AttributeValue> {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    if (typeof value === 'string') {
      acc[key] = { S: value };
    } else if (typeof value === 'number') {
      acc[key] = { N: value.toString() };
    } else if (typeof value === 'boolean') {
      acc[key] = { BOOL: value };
    } else if (Array.isArray(value)) {
      acc[key] = {
        L: value.map(item => {
          if (typeof item === 'string') {
            return { S: item };
          } else if (typeof item === 'number') {
            return { N: item.toString() };
          } else if (typeof item === 'object') {
            return { M: createMockDynamoDBItem(item) };
          }
          return { S: JSON.stringify(item) };
        }),
      };
    } else if (typeof value === 'object') {
      acc[key] = { M: createMockDynamoDBItem(value) };
    }

    return acc;
  }, {} as Record<string, DynamoDB.AttributeValue>);
}

export function parseDynamoDBItem(item: Record<string, DynamoDB.AttributeValue>): Record<string, any> {
  return Object.entries(item).reduce((acc, [key, value]) => {
    if (value.S !== undefined) {
      acc[key] = value.S;
    } else if (value.N !== undefined) {
      acc[key] = parseFloat(value.N);
    } else if (value.BOOL !== undefined) {
      acc[key] = value.BOOL;
    } else if (value.L !== undefined) {
      acc[key] = value.L.map(item => {
        if (item.S !== undefined) {
          return item.S;
        } else if (item.N !== undefined) {
          return parseFloat(item.N);
        } else if (item.M !== undefined) {
          return parseDynamoDBItem(item.M);
        }
        return JSON.parse(item.S || '{}');
      });
    } else if (value.M !== undefined) {
      acc[key] = parseDynamoDBItem(value.M);
    }

    return acc;
  }, {} as Record<string, any>);
}

export function mockAwsError(code: string, message: string): Error {
  const error = new Error(message);
  (error as any).code = code;
  return error;
}

export function mockPromiseResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}

export function mockPromiseError(error: Error): Promise<never> {
  return Promise.reject(error);
} 