import { ModelRegistry } from '../model-registry';
import { ModelGovernance } from '../model-governance';
import { ModelVersioning } from '../model-versioning';

describe('Model Management System', () => {
  let registry: ModelRegistry;
  let governance: ModelGovernance;
  let versioning: ModelVersioning;

  const mockConfig = {
    tableName: 'test_models',
    bucketName: 'test-models-bucket',
    region: 'us-east-1',
  };

  const mockModelMetadata = {
    modelId: 'test-model',
    version: '1.0.0',
    name: 'Test Model',
    type: 'text' as const,
    provider: 'claude' as const,
    status: 'development' as const,
    trainingData: {
      dataset: 'test-dataset',
      version: '1.0',
      size: 1000,
      lastUpdated: new Date().toISOString(),
    },
    performance: {
      accuracy: 0.95,
      confidence: 0.9,
      latency: 100,
      lastEvaluated: new Date().toISOString(),
    },
    governance: {
      owner: 'test-owner',
      approvers: ['test-approver'],
      complianceStatus: 'compliant' as const,
      riskLevel: 'low' as const,
    },
    changelog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockPolicy = {
    id: 'test-policy',
    name: 'Test Policy',
    description: 'Test policy for model governance',
    type: 'performance' as const,
    rules: [
      {
        id: 'accuracy-threshold',
        condition: 'model.performance.accuracy < 0.8',
        action: 'block' as const,
        message: 'Model accuracy is below required threshold',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    registry = new ModelRegistry(mockConfig);
    governance = new ModelGovernance(registry);
    versioning = new ModelVersioning(registry, governance);
  });

  describe('Model Registration', () => {
    it('should register a new model version', async () => {
      await expect(versioning.createVersion(
        mockModelMetadata.modelId,
        mockModelMetadata.version,
        mockModelMetadata,
        'major'
      )).resolves.not.toThrow();
    });

    it('should reject invalid semantic versions', async () => {
      await expect(versioning.createVersion(
        mockModelMetadata.modelId,
        'invalid-version',
        mockModelMetadata,
        'major'
      )).rejects.toThrow('Invalid semantic version');
    });
  });

  describe('Model Governance', () => {
    beforeEach(async () => {
      await governance.addPolicy(mockPolicy);
    });

    it('should enforce policy rules during promotion', async () => {
      const lowAccuracyModel = {
        ...mockModelMetadata,
        performance: {
          ...mockModelMetadata.performance,
          accuracy: 0.7,
        },
      };

      await versioning.createVersion(
        lowAccuracyModel.modelId,
        lowAccuracyModel.version,
        lowAccuracyModel,
        'major'
      );

      await expect(versioning.promoteVersion(
        lowAccuracyModel.modelId,
        lowAccuracyModel.version,
        'production',
        'test-approver'
      )).rejects.toThrow('policy violations');
    });

    it('should validate model metadata', async () => {
      const invalidMetadata = {
        ...mockModelMetadata,
        governance: {
          ...mockModelMetadata.governance,
          owner: '', // Required field
        },
      };

      const validation = await governance.validateModelMetadata(invalidMetadata);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Model owner is required');
    });
  });

  describe('Version Management', () => {
    beforeEach(async () => {
      await versioning.createVersion(
        mockModelMetadata.modelId,
        '1.0.0',
        mockModelMetadata,
        'major'
      );
    });

    it('should track version history', async () => {
      const history = await versioning.getVersionHistory(mockModelMetadata.modelId);
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe('1.0.0');
    });

    it('should compare versions', async () => {
      const updatedModel = {
        ...mockModelMetadata,
        version: '1.1.0',
        performance: {
          ...mockModelMetadata.performance,
          accuracy: 0.97,
        },
      };

      await versioning.createVersion(
        updatedModel.modelId,
        updatedModel.version,
        updatedModel,
        'minor'
      );

      const comparison = await versioning.compareVersions(
        mockModelMetadata.modelId,
        '1.0.0',
        '1.1.0'
      );

      expect(comparison.performanceDiff.accuracy).toBe(0.02);
    });

    it('should handle rollbacks correctly', async () => {
      await versioning.promoteVersion(
        mockModelMetadata.modelId,
        '1.0.0',
        'production',
        'test-approver'
      );

      const newVersion = {
        ...mockModelMetadata,
        version: '1.1.0',
      };

      await versioning.createVersion(
        newVersion.modelId,
        newVersion.version,
        newVersion,
        'minor'
      );

      await versioning.promoteVersion(
        newVersion.modelId,
        newVersion.version,
        'production',
        'test-approver'
      );

      await expect(versioning.rollbackVersion(
        mockModelMetadata.modelId,
        '1.1.0',
        '1.0.0',
        'test-approver',
        'Performance issues'
      )).resolves.not.toThrow();
    });
  });
}); 