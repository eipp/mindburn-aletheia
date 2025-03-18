import {
  StorageService,
  LoggerService,
  EventBus,
  ModelMetadata,
  ModelStatus,
  PerformanceMetrics,
  AuditReport,
  ChangelogEntry,
} from '@mindburn/shared';
import { z } from 'zod';
import * as semver from 'semver';

const ModelMetadataSchema = z.object({
  modelId: z.string(),
  version: z.string(), // Semantic version
  name: z.string(),
  type: z.enum(['text', 'image', 'multimodal']),
  provider: z.enum(['claude', 'gemini', 'perplexity', 'custom']),
  status: z.enum(['development', 'staging', 'production', 'retired']),
  trainingData: z.object({
    dataset: z.string(),
    version: z.string(),
    size: z.number(),
    lastUpdated: z.string(),
  }),
  performance: z.object({
    accuracy: z.number(),
    confidence: z.number(),
    latency: z.number(),
    lastEvaluated: z.string(),
  }),
  governance: z.object({
    owner: z.string(),
    approvers: z.array(z.string()),
    lastAudit: z.string().optional(),
    complianceStatus: z.enum(['compliant', 'pending_review', 'non_compliant']),
    riskLevel: z.enum(['low', 'medium', 'high']),
  }),
  changelog: z.array(
    z.object({
      version: z.string(),
      date: z.string(),
      author: z.string(),
      changes: z.array(z.string()),
      type: z.enum(['major', 'minor', 'patch']),
    })
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class ModelRegistry {
  private storage: StorageService;
  private logger: LoggerService;
  private eventBus: EventBus;

  constructor() {
    this.storage = new StorageService();
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
  }

  async registerModel(metadata: ModelMetadata): Promise<void> {
    ModelMetadataSchema.parse(metadata);

    try {
      this.logger.info('Registering model', { modelId: metadata.modelId });

      // Validate semantic version
      if (!semver.valid(metadata.version)) {
        throw new Error(`Invalid semantic version: ${metadata.version}`);
      }

      // Store model metadata
      await this.storage.put('models', {
        ...metadata,
        updatedAt: new Date().toISOString(),
      });

      // Emit model registration event
      await this.eventBus.emit('model.registered', {
        modelId: metadata.modelId,
        version: metadata.version,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model registered successfully', {
        modelId: metadata.modelId,
        version: metadata.version,
      });
    } catch (error) {
      this.logger.error('Failed to register model', {
        modelId: metadata.modelId,
        error,
      });
      throw error;
    }
  }

  async updateModelStatus(
    modelId: string,
    version: string,
    status: ModelStatus,
    approver: string
  ): Promise<void> {
    try {
      this.logger.info('Updating model status', { modelId, version, status });

      const model = await this.getModel(modelId, version);

      if (!model) {
        throw new Error(`Model not found: ${modelId}@${version}`);
      }

      if (!model.governance.approvers.includes(approver)) {
        throw new Error(`Unauthorized: ${approver} is not an approved reviewer`);
      }

      await this.storage.update('models', `${modelId}:${version}`, {
        status,
        updatedAt: new Date().toISOString(),
      });

      await this.eventBus.emit('model.status.updated', {
        modelId,
        version,
        oldStatus: model.status,
        newStatus: status,
        approver,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model status updated', { modelId, version, status });
    } catch (error) {
      this.logger.error('Failed to update model status', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async updatePerformanceMetrics(
    modelId: string,
    version: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
      this.logger.info('Updating performance metrics', { modelId, version });

      const model = await this.getModel(modelId, version);

      if (!model) {
        throw new Error(`Model not found: ${modelId}@${version}`);
      }

      const updatedPerformance = {
        ...model.performance,
        ...metrics,
        lastEvaluated: new Date().toISOString(),
      };

      await this.storage.update('models', `${modelId}:${version}`, {
        performance: updatedPerformance,
        updatedAt: new Date().toISOString(),
      });

      await this.eventBus.emit('model.metrics.updated', {
        modelId,
        version,
        metrics,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Performance metrics updated', { modelId, version });
    } catch (error) {
      this.logger.error('Failed to update performance metrics', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async addChangelogEntry(modelId: string, version: string, entry: ChangelogEntry): Promise<void> {
    try {
      this.logger.info('Adding changelog entry', { modelId, version });

      const model = await this.getModel(modelId, version);

      if (!model) {
        throw new Error(`Model not found: ${modelId}@${version}`);
      }

      const changelogEntry = {
        ...entry,
        version,
        date: new Date().toISOString(),
      };

      await this.storage.update('models', `${modelId}:${version}`, {
        changelog: [...model.changelog, changelogEntry],
        updatedAt: new Date().toISOString(),
      });

      await this.eventBus.emit('model.changelog.updated', {
        modelId,
        version,
        entry: changelogEntry,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Changelog entry added', { modelId, version });
    } catch (error) {
      this.logger.error('Failed to add changelog entry', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async conductAudit(modelId: string, version: string, audit: AuditReport): Promise<void> {
    try {
      this.logger.info('Conducting audit', { modelId, version });

      const model = await this.getModel(modelId, version);

      if (!model) {
        throw new Error(`Model not found: ${modelId}@${version}`);
      }

      const updatedGovernance = {
        ...model.governance,
        lastAudit: new Date().toISOString(),
        complianceStatus: audit.complianceStatus,
        riskLevel: audit.riskAssessment.level,
      };

      await this.storage.update('models', `${modelId}:${version}`, {
        governance: updatedGovernance,
        updatedAt: new Date().toISOString(),
      });

      await this.storage.put('audits', {
        modelId,
        version,
        ...audit,
        timestamp: new Date().toISOString(),
      });

      await this.eventBus.emit('model.audit.completed', {
        modelId,
        version,
        audit,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Audit completed', { modelId, version });
    } catch (error) {
      this.logger.error('Failed to conduct audit', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }

  async listModelVersions(modelId: string): Promise<ModelMetadata[]> {
    try {
      this.logger.info('Listing model versions', { modelId });
      const versions = await this.storage.query('models', { modelId });
      return versions as ModelMetadata[];
    } catch (error) {
      this.logger.error('Failed to list model versions', {
        modelId,
        error,
      });
      throw error;
    }
  }

  private async getModel(modelId: string, version: string): Promise<ModelMetadata | null> {
    try {
      return (await this.storage.get('models', `${modelId}:${version}`)) as ModelMetadata;
    } catch (error) {
      this.logger.error('Failed to get model', {
        modelId,
        version,
        error,
      });
      throw error;
    }
  }
}
