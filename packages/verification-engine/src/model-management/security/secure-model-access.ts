import { SecurityConfig } from './security-config';
import { AuthService } from './auth-service';
import { ModelRegistry } from '../model-registry';
import { z } from 'zod';

const SecureAccessConfigSchema = z.object({
  encryptSensitiveFields: z.boolean().default(true),
  auditAccess: z.boolean().default(true),
  requiredPermissions: z.record(z.array(z.string())).default({}),
});

export class SecureModelAccess {
  private security: SecurityConfig;
  private auth: AuthService;
  private registry: ModelRegistry;
  private config: z.infer<typeof SecureAccessConfigSchema>;

  constructor(
    security: SecurityConfig,
    auth: AuthService,
    registry: ModelRegistry,
    config: z.infer<typeof SecureAccessConfigSchema>
  ) {
    this.security = security;
    this.auth = auth;
    this.registry = registry;
    this.config = SecureAccessConfigSchema.parse(config);
  }

  async getModel(
    modelId: string,
    version: string,
    accessToken: string
  ): Promise<any> {
    // Verify token and get user info
    const userInfo = await this.auth.verifyToken(accessToken);
    if (!userInfo.isValid) {
      throw new Error('Invalid access token');
    }

    // Check permissions
    const requiredPerms = this.config.requiredPermissions['getModel'] || ['model:read'];
    await this.auth.enforcePermissions(userInfo.username, requiredPerms);

    // Get model data
    const model = await this.registry.getModel(modelId, version);
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    // Decrypt sensitive fields if needed
    if (this.config.encryptSensitiveFields) {
      model.performance = await this.decryptPerformanceData(
        model.performance,
        { modelId, version, user: userInfo.username }
      );
    }

    // Audit access if enabled
    if (this.config.auditAccess) {
      await this.auditModelAccess({
        modelId,
        version,
        user: userInfo.username,
        action: 'read',
        timestamp: new Date().toISOString(),
      });
    }

    return model;
  }

  async updateModel(
    modelId: string,
    version: string,
    updates: any,
    accessToken: string
  ): Promise<void> {
    // Verify token and get user info
    const userInfo = await this.auth.verifyToken(accessToken);
    if (!userInfo.isValid) {
      throw new Error('Invalid access token');
    }

    // Check permissions
    const requiredPerms = this.config.requiredPermissions['updateModel'] || ['model:write'];
    await this.auth.enforcePermissions(userInfo.username, requiredPerms);

    // Encrypt sensitive fields if needed
    if (this.config.encryptSensitiveFields && updates.performance) {
      updates.performance = await this.encryptPerformanceData(
        updates.performance,
        { modelId, version, user: userInfo.username }
      );
    }

    // Update model
    await this.registry.updateModelStatus(
      modelId,
      version,
      updates.status,
      userInfo.username
    );

    // Audit update if enabled
    if (this.config.auditAccess) {
      await this.auditModelAccess({
        modelId,
        version,
        user: userInfo.username,
        action: 'update',
        timestamp: new Date().toISOString(),
        changes: updates,
      });
    }
  }

  private async encryptPerformanceData(
    performance: any,
    context: Record<string, string>
  ): Promise<any> {
    const encryptedData = await this.security.encryptData(
      JSON.stringify(performance),
      context
    );

    return {
      ...performance,
      encryptedMetrics: encryptedData,
    };
  }

  private async decryptPerformanceData(
    performance: any,
    context: Record<string, string>
  ): Promise<any> {
    if (!performance.encryptedMetrics) {
      return performance;
    }

    const decryptedData = await this.security.decryptData(
      performance.encryptedMetrics,
      context
    );

    return {
      ...performance,
      ...JSON.parse(decryptedData),
    };
  }

  private async auditModelAccess(event: {
    modelId: string;
    version: string;
    user: string;
    action: string;
    timestamp: string;
    changes?: any;
  }): Promise<void> {
    await this.registry.logModelEvent({
      modelId: event.modelId,
      eventType: 'model_access',
      details: {
        version: event.version,
        user: event.user,
        action: event.action,
        timestamp: event.timestamp,
        changes: event.changes,
      },
    });
  }
} 