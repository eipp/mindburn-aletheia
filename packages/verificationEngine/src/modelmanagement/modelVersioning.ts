import {
  ModelRegistry,
  ModelGovernance,
  LoggerService,
  EventBus,
  ModelMetadata,
  ModelStatus,
  VersionHistoryEntry,
  VersionComparison,
  VersionUpdateRequest,
} from '@mindburn/shared';
import * as semver from 'semver';
import { z } from 'zod';

const VersionUpdateSchema = z.object({
  modelId: z.string(),
  currentVersion: z.string(),
  updateType: z.enum(['major', 'minor', 'patch']),
  changes: z.array(z.string()),
  author: z.string(),
  performance: z
    .object({
      accuracy: z.number(),
      confidence: z.number(),
      latency: z.number(),
    })
    .optional(),
});

export class ModelVersioning {
  private registry: ModelRegistry;
  private governance: ModelGovernance;
  private logger: LoggerService;
  private eventBus: EventBus;

  constructor(registry: ModelRegistry, governance: ModelGovernance) {
    this.registry = registry;
    this.governance = governance;
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
  }

  async createVersion(
    modelId: string,
    version: string,
    metadata: ModelMetadata,
    type: 'major' | 'minor' | 'patch'
  ): Promise<void> {
    try {
      this.logger.info('Creating new model version', {
        modelId,
        version,
        type,
      });

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
        changelog: [
          {
            version,
            date: new Date().toISOString(),
            author: metadata.governance.owner,
            changes: metadata.changelog || [],
            type,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await this.eventBus.emit('model.version.created', {
        modelId,
        version,
        type,
        author: metadata.governance.owner,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model version created successfully', {
        modelId,
        version,
      });
    } catch (error) {
      this.logger.error('Failed to create model version', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async promoteVersion(
    modelId: string,
    version: string,
    targetStatus: ModelStatus,
    approver: string
  ): Promise<void> {
    try {
      this.logger.info('Promoting model version', {
        modelId,
        version,
        targetStatus,
        approver,
      });

      // Check compliance before promotion
      await this.governance.enforcePromotionPolicy(modelId, version, targetStatus);

      // Update model status
      await this.registry.updateModelStatus(modelId, version, targetStatus, approver);

      // Schedule audit if promoting to production
      if (targetStatus === 'production') {
        await this.governance.scheduleAudit(modelId, version, approver);
      }

      await this.eventBus.emit('model.version.promoted', {
        modelId,
        version,
        targetStatus,
        approver,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model version promoted successfully', {
        modelId,
        version,
        targetStatus,
      });
    } catch (error) {
      this.logger.error('Failed to promote model version', {
        modelId,
        version,
        targetStatus,
        error,
      });
      throw error;
    }
  }

  async retireVersion(
    modelId: string,
    version: string,
    approver: string,
    reason: string
  ): Promise<void> {
    try {
      this.logger.info('Retiring model version', {
        modelId,
        version,
        approver,
      });

      await this.registry.updateModelStatus(modelId, version, 'retired', approver);

      await this.registry.addChangelogEntry(modelId, version, {
        author: approver,
        changes: [`Retired: ${reason}`],
        type: 'patch',
      });

      await this.eventBus.emit('model.version.retired', {
        modelId,
        version,
        approver,
        reason,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model version retired successfully', {
        modelId,
        version,
      });
    } catch (error) {
      this.logger.error('Failed to retire model version', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async getVersionHistory(modelId: string): Promise<VersionHistoryEntry[]> {
    try {
      this.logger.info('Getting version history', { modelId });

      const model = await this.registry.getModel(modelId, 'latest');
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      const history = model.changelog.map(entry => ({
        version: entry.version,
        date: entry.date,
        author: entry.author,
        changes: entry.changes,
        type: entry.type,
        status: model.status,
      }));

      this.logger.info('Version history retrieved', {
        modelId,
        versionCount: history.length,
      });

      return history;
    } catch (error) {
      this.logger.error('Failed to get version history', {
        modelId,
        error,
      });
      throw error;
    }
  }

  async compareVersions(
    modelId: string,
    version1: string,
    version2: string
  ): Promise<VersionComparison> {
    try {
      this.logger.info('Comparing model versions', {
        modelId,
        version1,
        version2,
      });

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

      const comparison: VersionComparison = {
        version1,
        version2,
        performanceDiff,
        changes,
        riskLevelChanged: model1.governance.riskLevel !== model2.governance.riskLevel,
        complianceStatusChanged:
          model1.governance.complianceStatus !== model2.governance.complianceStatus,
      };

      await this.eventBus.emit('model.versions.compared', {
        modelId,
        version1,
        version2,
        comparison,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Version comparison completed', {
        modelId,
        version1,
        version2,
        changeCount: changes.length,
      });

      return comparison;
    } catch (error) {
      this.logger.error('Failed to compare versions', {
        modelId,
        version1,
        version2,
        error,
      });
      throw error;
    }
  }

  async rollbackVersion(
    modelId: string,
    fromVersion: string,
    toVersion: string,
    approver: string,
    reason: string
  ): Promise<void> {
    try {
      this.logger.info('Rolling back model version', {
        modelId,
        fromVersion,
        toVersion,
        approver,
      });

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

      await this.eventBus.emit('model.version.rolledback', {
        modelId,
        fromVersion,
        toVersion,
        approver,
        reason,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model version rolled back successfully', {
        modelId,
        fromVersion,
        toVersion,
      });
    } catch (error) {
      this.logger.error('Failed to rollback version', {
        modelId,
        fromVersion,
        toVersion,
        error,
      });
      throw error;
    }
  }
}
