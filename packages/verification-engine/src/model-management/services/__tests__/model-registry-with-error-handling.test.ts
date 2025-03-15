import { ModelRegistryWithErrorHandling } from '../model-registry-with-error-handling';
import { ModelRegistry } from '../../model-registry';
import { defaultConfig } from '../../config/error-handling-config';
import { ModelMetadata, ModelStatus, PerformanceMetrics, AuditReport } from '../../types';

jest.mock('../../model-registry');

describe('ModelRegistryWithErrorHandling', () => {
  let modelRegistry: jest.Mocked<ModelRegistry>;
  let registryWithErrorHandling: ModelRegistryWithErrorHandling;

  const mockModelMetadata: ModelMetadata = {
    modelId: 'test-model',
    version: '1.0.0',
    name: 'Test Model',
    type: 'classification',
    provider: 'openai',
    status: 'pending',
    trainingData: {
      source: 'synthetic',
      size: 1000,
      lastUpdated: new Date().toISOString(),
    },
    performance: {
      accuracy: 0.95,
      f1Score: 0.94,
      precision: 0.93,
      recall: 0.92,
      lastEvaluated: new Date().toISOString(),
    },
    governance: {
      approvers: ['user1'],
      lastAuditDate: new Date().toISOString(),
      complianceStatus: 'compliant',
      auditReports: [],
    },
    changelog: [],
  };

  const mockPerformanceMetrics: PerformanceMetrics = {
    accuracy: 0.96,
    f1Score: 0.95,
    precision: 0.94,
    recall: 0.93,
    lastEvaluated: new Date().toISOString(),
  };

  const mockAuditReport: AuditReport = {
    type: 'security',
    date: new Date().toISOString(),
    auditor: 'auditor1',
    findings: [],
    recommendations: [],
    status: 'passed',
  };

  beforeEach(() => {
    modelRegistry = {
      registerModel: jest.fn(),
      updateModelStatus: jest.fn(),
      updatePerformanceMetrics: jest.fn(),
      addChangelogEntry: jest.fn(),
      conductAudit: jest.fn(),
      getModel: jest.fn(),
    } as unknown as jest.Mocked<ModelRegistry>;

    registryWithErrorHandling = new ModelRegistryWithErrorHandling(
      defaultConfig,
      modelRegistry
    );
  });

  describe('registerModel', () => {
    it('should successfully register a model', async () => {
      await registryWithErrorHandling.registerModel(mockModelMetadata);
      expect(modelRegistry.registerModel).toHaveBeenCalledWith(mockModelMetadata);
    });

    it('should handle registration failure', async () => {
      const error = new Error('Registration failed');
      modelRegistry.registerModel.mockRejectedValue(error);

      await expect(registryWithErrorHandling.registerModel(mockModelMetadata))
        .rejects.toThrow('Registration failed');
    });
  });

  describe('updateModelStatus', () => {
    it('should successfully update model status', async () => {
      const status: ModelStatus = 'approved';
      const approver = 'user1';

      await registryWithErrorHandling.updateModelStatus(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        status,
        approver
      );

      expect(modelRegistry.updateModelStatus).toHaveBeenCalledWith(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        status,
        approver
      );
    });

    it('should handle status update failure', async () => {
      const error = new Error('Status update failed');
      modelRegistry.updateModelStatus.mockRejectedValue(error);

      await expect(registryWithErrorHandling.updateModelStatus(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        'approved',
        'user1'
      )).rejects.toThrow('Status update failed');
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('should successfully update performance metrics', async () => {
      await registryWithErrorHandling.updatePerformanceMetrics(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockPerformanceMetrics
      );

      expect(modelRegistry.updatePerformanceMetrics).toHaveBeenCalledWith(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockPerformanceMetrics
      );
    });

    it('should handle metrics update failure', async () => {
      const error = new Error('Metrics update failed');
      modelRegistry.updatePerformanceMetrics.mockRejectedValue(error);

      await expect(registryWithErrorHandling.updatePerformanceMetrics(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockPerformanceMetrics
      )).rejects.toThrow('Metrics update failed');
    });
  });

  describe('addChangelogEntry', () => {
    it('should successfully add changelog entry', async () => {
      const entry = 'Test changelog entry';
      const author = 'user1';

      await registryWithErrorHandling.addChangelogEntry(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        entry,
        author
      );

      expect(modelRegistry.addChangelogEntry).toHaveBeenCalledWith(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        entry,
        author
      );
    });

    it('should handle changelog entry failure', async () => {
      const error = new Error('Changelog entry failed');
      modelRegistry.addChangelogEntry.mockRejectedValue(error);

      await expect(registryWithErrorHandling.addChangelogEntry(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        'Test entry',
        'user1'
      )).rejects.toThrow('Changelog entry failed');
    });
  });

  describe('conductAudit', () => {
    it('should successfully conduct audit', async () => {
      await registryWithErrorHandling.conductAudit(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockAuditReport
      );

      expect(modelRegistry.conductAudit).toHaveBeenCalledWith(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockAuditReport
      );
    });

    it('should handle audit failure', async () => {
      const error = new Error('Audit failed');
      modelRegistry.conductAudit.mockRejectedValue(error);

      await expect(registryWithErrorHandling.conductAudit(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockAuditReport
      )).rejects.toThrow('Audit failed');
    });
  });

  describe('getModel', () => {
    it('should successfully get model', async () => {
      modelRegistry.getModel.mockResolvedValue(mockModelMetadata);

      const result = await registryWithErrorHandling.getModel(
        mockModelMetadata.modelId,
        mockModelMetadata.version
      );

      expect(result).toEqual(mockModelMetadata);
      expect(modelRegistry.getModel).toHaveBeenCalledWith(
        mockModelMetadata.modelId,
        mockModelMetadata.version
      );
    });

    it('should handle get model failure', async () => {
      const error = new Error('Get model failed');
      modelRegistry.getModel.mockRejectedValue(error);

      await expect(registryWithErrorHandling.getModel(
        mockModelMetadata.modelId,
        mockModelMetadata.version
      )).rejects.toThrow('Get model failed');
    });
  });

  describe('error metrics', () => {
    it('should track and clear error metrics', async () => {
      const error = new Error('Operation failed');
      modelRegistry.registerModel.mockRejectedValue(error);

      await expect(registryWithErrorHandling.registerModel(mockModelMetadata))
        .rejects.toThrow('Operation failed');

      const metrics = registryWithErrorHandling.getErrorMetrics('modelRegistration');
      expect(metrics).toBeDefined();
      expect(metrics!.errorCount).toBe(1);

      registryWithErrorHandling.clearErrorMetrics('modelRegistration');
      expect(registryWithErrorHandling.getErrorMetrics('modelRegistration')).toBeUndefined();
    });
  });
}); 