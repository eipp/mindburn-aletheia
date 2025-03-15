import { validateConfig, getEnvironmentConfig, defaultConfig } from '../model-registry-config';

describe('ModelRegistryConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should validate a complete config', () => {
      const config = validateConfig(defaultConfig);
      expect(config).toEqual(defaultConfig);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig = {
        dynamoTable: 'custom-table',
        environment: 'staging',
      };

      const config = validateConfig(partialConfig);
      expect(config).toEqual({
        ...defaultConfig,
        ...partialConfig,
      });
    });

    it('should throw error for invalid config values', () => {
      const invalidConfig = {
        ...defaultConfig,
        auditFrequencyDays: 0,
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should validate security settings', () => {
      const configWithSecurity = {
        ...defaultConfig,
        securitySettings: {
          encryptionAtRest: true,
          encryptionInTransit: true,
          accessLogging: true,
          ipRestrictions: ['10.0.0.0/8'],
        },
      };

      const config = validateConfig(configWithSecurity);
      expect(config.securitySettings.ipRestrictions).toEqual(['10.0.0.0/8']);
    });

    it('should validate performance monitoring settings', () => {
      const configWithMonitoring = {
        ...defaultConfig,
        performanceMonitoring: {
          enabled: true,
          metricCollectionInterval: 60,
          baselineMetrics: ['custom_metric'],
        },
      };

      const config = validateConfig(configWithMonitoring);
      expect(config.performanceMonitoring.metricCollectionInterval).toBe(60);
      expect(config.performanceMonitoring.baselineMetrics).toContain('custom_metric');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should use environment variables when available', () => {
      process.env.MODEL_REGISTRY_TABLE = 'env-table';
      process.env.MODEL_ARTIFACTS_BUCKET = 'env-bucket';
      process.env.KMS_KEY_ID = 'env-key';
      process.env.AWS_REGION = 'us-west-2';
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      process.env.APPROVAL_WORKFLOW_ENABLED = 'true';
      process.env.AUTO_PROMOTE_TO_PRODUCTION = 'true';

      const config = getEnvironmentConfig();

      expect(config.dynamoTable).toBe('env-table');
      expect(config.s3Bucket).toBe('env-bucket');
      expect(config.kmsKeyId).toBe('env-key');
      expect(config.region).toBe('us-west-2');
      expect(config.environment).toBe('production');
      expect(config.loggingLevel).toBe('debug');
      expect(config.approvalWorkflowEnabled).toBe(true);
      expect(config.autoPromoteToProduction).toBe(true);
    });

    it('should use default values when environment variables are not set', () => {
      const config = getEnvironmentConfig();

      expect(config.dynamoTable).toBe(defaultConfig.dynamoTable);
      expect(config.s3Bucket).toBe(defaultConfig.s3Bucket);
      expect(config.kmsKeyId).toBe(defaultConfig.kmsKeyId);
      expect(config.region).toBe(defaultConfig.region);
      expect(config.environment).toBe(defaultConfig.environment);
      expect(config.loggingLevel).toBe(defaultConfig.loggingLevel);
      expect(config.approvalWorkflowEnabled).toBe(defaultConfig.approvalWorkflowEnabled);
      expect(config.autoPromoteToProduction).toBe(defaultConfig.autoPromoteToProduction);
    });

    it('should validate environment config', () => {
      process.env.LOG_LEVEL = 'invalid';

      expect(() => getEnvironmentConfig()).toThrow();
    });
  });
}); 