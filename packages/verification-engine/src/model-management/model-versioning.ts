import { ModelRegistry } from './model-registry';
import { ModelGovernance } from './model-governance';
import * as semver from 'semver';
import { z } from 'zod';

const VersionUpdateSchema = z.object({
  modelId: z.string(),
  currentVersion: z.string(),
  updateType: z.enum(['major', 'minor', 'patch']),
  changes: z.array(z.string()),
  author: z.string(),
  performance: z.object({
    accuracy: z.number(),
    confidence: z.number(),
    latency: z.number(),
  }).optional(),
});

export class ModelVersioning {
  private registry: ModelRegistry;
  private governance: ModelGovernance;

  constructor(registry: ModelRegistry, governance: ModelGovernance) {
    this.registry = registry;
    this.governance = governance;
  }

  async createVersion(
    modelId: string,
    version: string,
    metadata: any,
    type: 'major' | 'minor' | 'patch'
  ): Promise<void> {
    // Validate version format
    if (!semver.valid(version)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    // Validate metadata
    const validation = await this.governance.validateModelMetadata(metadata);
    if (!validation.isValid) {
      throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
    }

    // Register new version
    await this.registry.registerModel({
      ...metadata,
      modelId,
      version,
      status: 'development',
      changelog: [{
        version,
        date: new Date().toISOString(),
        author: metadata.governance.owner,
        changes: metadata.changelog || [],
        type,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async promoteVersion(
    modelId: string,
    version: string,
    targetStatus: 'staging' | 'production',
    approver: string
  ): Promise<void> {
    // Check compliance before promotion
    await this.governance.enforcePromotionPolicy(modelId, version, targetStatus);

    // Update model status
    await this.registry.updateModelStatus(modelId, version, targetStatus, approver);

    // Schedule audit if promoting to production
    if (targetStatus === 'production') {
      await this.governance.scheduleAudit(modelId, version, approver);
    }
  }

  async retireVersion(
    modelId: string,
    version: string,
    approver: string,
    reason: string
  ): Promise<void> {
    await this.registry.updateModelStatus(modelId, version, 'retired', approver);
    
    await this.registry.addChangelogEntry(modelId, version, {
      author: approver,
      changes: [`Retired: ${reason}`],
      type: 'patch',
    });
  }

  async getVersionHistory(modelId: string): Promise<VersionHistoryEntry[]> {
    const model = await this.registry.getModel(modelId, 'latest');
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    return model.changelog.map(entry => ({
      version: entry.version,
      date: entry.date,
      author: entry.author,
      changes: entry.changes,
      type: entry.type,
      status: model.status,
    }));
  }

  async compareVersions(
    modelId: string,
    version1: string,
    version2: string
  ): Promise<VersionComparison> {
    const [model1, model2] = await Promise.all([
      this.registry.getModel(modelId, version1),
      this.registry.getModel(modelId, version2),
    ]);

    if (!model1 || !model2) {
      throw new Error('One or both versions not found');
    }

    const performanceDiff = {
      accuracy: model2.performance.accuracy - model1.performance.accuracy,
      confidence: model2.performance.confidence - model1.performance.confidence,
      latency: model2.performance.latency - model1.performance.latency,
    };

    const changes = model2.changelog
      .filter(entry => semver.gt(entry.version, version1))
      .reduce((acc, entry) => [...acc, ...entry.changes], [] as string[]);

    return {
      version1,
      version2,
      performanceDiff,
      changes,
      riskLevelChanged: model1.governance.riskLevel !== model2.governance.riskLevel,
      complianceStatusChanged: 
        model1.governance.complianceStatus !== model2.governance.complianceStatus,
    };
  }

  async rollbackVersion(
    modelId: string,
    fromVersion: string,
    toVersion: string,
    approver: string,
    reason: string
  ): Promise<void> {
    const [currentModel, targetModel] = await Promise.all([
      this.registry.getModel(modelId, fromVersion),
      this.registry.getModel(modelId, toVersion),
    ]);

    if (!currentModel || !targetModel) {
      throw new Error('One or both versions not found');
    }

    // Verify approver authorization
    if (!currentModel.governance.approvers.includes(approver)) {
      throw new Error(`Unauthorized: ${approver} is not an approved reviewer`);
    }

    // Update status of current version to retired
    await this.registry.updateModelStatus(modelId, fromVersion, 'retired', approver);

    // Restore previous version to production/staging
    await this.registry.updateModelStatus(modelId, toVersion, targetModel.status, approver);

    // Log rollback in changelog
    await this.registry.addChangelogEntry(modelId, fromVersion, {
      author: approver,
      changes: [`Rolled back to version ${toVersion}: ${reason}`],
      type: 'patch',
    });
  }
}

interface VersionHistoryEntry {
  version: string;
  date: string;
  author: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
  status: 'development' | 'staging' | 'production' | 'retired';
}

interface VersionComparison {
  version1: string;
  version2: string;
  performanceDiff: {
    accuracy: number;
    confidence: number;
    latency: number;
  };
  changes: string[];
  riskLevelChanged: boolean;
  complianceStatusChanged: boolean;
} 