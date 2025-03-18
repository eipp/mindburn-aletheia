import {
  ModelMetadata,
  ApprovalStage,
  MetricConfig,
  StorageItem,
  StorageService,
} from '@mindburn/shared';

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

export function createMockStorageItem<T extends object>(data: T): StorageItem<T> {
  return {
    id: 'test-id',
    type: 'test-type',
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

export function mockStorageService(): jest.Mocked<StorageService> {
  return {
    get: jest.fn(),
    put: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    query: jest.fn(),
  };
}

export function mockError(code: string, message: string): Error {
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
