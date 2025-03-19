import {
  AuthService,
  LoggerService,
  EventBus,
  UserProfile,
  AuthConfig,
  createConfigValidator,
  z,
} from '@mindburn/shared';

const AuthConfigSchema = z.object({
  userPoolId: z.string(),
  clientId: z.string(),
  region: z.string(),
  tokenExpiration: z.number().min(300).max(86400),
});

const defaultConfig: AuthConfig = {
  userPoolId: '',
  clientId: '',
  region: 'us-east-1',
  tokenExpiration: 3600,
};

const envMap = {
  userPoolId: 'MODEL_USER_POOL_ID',
  clientId: 'MODEL_CLIENT_ID',
  region: 'AWS_REGION',
  tokenExpiration: 'MODEL_TOKEN_EXPIRATION',
};

export const validateConfig = createConfigValidator({
  schema: AuthConfigSchema,
  defaultConfig,
  envMap,
});

export const getConfig = () => validateConfig({});

export class ModelAuthService {
  private authService: AuthService;
  private logger: LoggerService;
  private eventBus: EventBus;
  private config: AuthConfig;

  constructor() {
    this.config = getConfig();
    this.authService = new AuthService(this.config);
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
  }

  async authenticateUser(username: string, password: string): Promise<UserProfile> {
    try {
      this.logger.info('Authenticating user', { username });
      const user = await this.authService.authenticate(username, password);

      await this.eventBus.emit('model.auth.login', {
        username,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('User authenticated successfully', { username });
      return user;
    } catch (error) {
      this.logger.error('Authentication failed', { username, error });
      throw error;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      this.logger.info('Validating token');
      const isValid = await this.authService.validateToken(token);

      if (!isValid) {
        this.logger.warn('Invalid token detected');
        await this.eventBus.emit('model.auth.invalid_token', {
          timestamp: new Date().toISOString(),
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Token validation failed', { error });
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      this.logger.info('Fetching user profile', { userId });
      return await this.authService.getUserProfile(userId);
    } catch (error) {
      this.logger.error('Failed to fetch user profile', { userId, error });
      throw error;
    }
  }

  async updateUserAttributes(userId: string, attributes: Record<string, string>): Promise<void> {
    try {
      this.logger.info('Updating user attributes', { userId });
      await this.authService.updateUserAttributes(userId, attributes);

      await this.eventBus.emit('model.auth.profile_updated', {
        userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('User attributes updated successfully', { userId });
    } catch (error) {
      this.logger.error('Failed to update user attributes', { userId, error });
      throw error;
    }
  }
}
