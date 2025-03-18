import {
  SecurityService,
  LoggerService,
  EventBus,
  ModelAccess,
  AccessLevel,
  createConfigValidator,
  z,
} from '@mindburn/shared';

const SecureAccessConfigSchema = z.object({
  encryptionEnabled: z.boolean(),
  accessLevels: z.array(z.enum(['read', 'write', 'admin'])),
  maxConcurrentAccess: z.number().min(1).max(100),
  accessTimeout: z.number().min(60).max(3600),
});

const defaultConfig = {
  encryptionEnabled: true,
  accessLevels: ['read', 'write', 'admin'] as AccessLevel[],
  maxConcurrentAccess: 10,
  accessTimeout: 300,
};

const envMap = {
  encryptionEnabled: 'MODEL_ENCRYPTION_ENABLED',
  maxConcurrentAccess: 'MODEL_MAX_CONCURRENT_ACCESS',
  accessTimeout: 'MODEL_ACCESS_TIMEOUT',
};

export const validateConfig = createConfigValidator({
  schema: SecureAccessConfigSchema,
  defaultConfig,
  envMap,
});

export const getConfig = () => validateConfig({});

export class SecureModelAccess {
  private securityService: SecurityService;
  private logger: LoggerService;
  private eventBus: EventBus;
  private config = getConfig();
  private activeAccess = new Map<string, ModelAccess>();

  constructor() {
    this.securityService = new SecurityService();
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
  }

  async grantAccess(modelId: string, userId: string, level: AccessLevel): Promise<ModelAccess> {
    try {
      this.logger.info('Granting model access', { modelId, userId, level });

      if (this.activeAccess.size >= this.config.maxConcurrentAccess) {
        throw new Error('Maximum concurrent access limit reached');
      }

      if (!this.config.accessLevels.includes(level)) {
        throw new Error(`Invalid access level: ${level}`);
      }

      const accessToken = await this.securityService.generateAccessToken({
        modelId,
        userId,
        level,
        expiration: Date.now() + this.config.accessTimeout * 1000,
      });

      const access: ModelAccess = {
        token: accessToken,
        modelId,
        userId,
        level,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.config.accessTimeout * 1000).toISOString(),
      };

      this.activeAccess.set(accessToken, access);

      await this.eventBus.emit('model.access.granted', {
        modelId,
        userId,
        level,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model access granted successfully', { modelId, userId });
      return access;
    } catch (error) {
      this.logger.error('Failed to grant model access', { modelId, userId, error });
      throw error;
    }
  }

  async validateAccess(token: string): Promise<ModelAccess> {
    try {
      this.logger.info('Validating model access');

      const access = this.activeAccess.get(token);
      if (!access) {
        throw new Error('Invalid access token');
      }

      const isValid = await this.securityService.validateAccessToken(token);
      if (!isValid) {
        this.activeAccess.delete(token);
        throw new Error('Access token expired');
      }

      return access;
    } catch (error) {
      this.logger.error('Failed to validate model access', { error });
      throw error;
    }
  }

  async revokeAccess(token: string): Promise<void> {
    try {
      this.logger.info('Revoking model access');

      const access = this.activeAccess.get(token);
      if (!access) {
        throw new Error('Invalid access token');
      }

      this.activeAccess.delete(token);

      await this.eventBus.emit('model.access.revoked', {
        modelId: access.modelId,
        userId: access.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model access revoked successfully', {
        modelId: access.modelId,
        userId: access.userId,
      });
    } catch (error) {
      this.logger.error('Failed to revoke model access', { error });
      throw error;
    }
  }

  async listActiveAccess(modelId: string): Promise<ModelAccess[]> {
    try {
      this.logger.info('Listing active model access', { modelId });

      const activeAccess = Array.from(this.activeAccess.values()).filter(
        access => access.modelId === modelId
      );

      this.logger.info('Active model access retrieved', {
        modelId,
        count: activeAccess.length,
      });

      return activeAccess;
    } catch (error) {
      this.logger.error('Failed to list active model access', { modelId, error });
      throw error;
    }
  }
}
