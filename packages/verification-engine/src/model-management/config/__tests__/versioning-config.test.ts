import { validateConfig, getEnvironmentConfig, defaultConfig } from '../versioning-config';

describe('VersioningConfig', () => {
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
        enabled: false,
        rules: {
          strategy: 'timestamp' as const,
          autoIncrement: false,
        },
      };

      const config = validateConfig(partialConfig);
      expect(config.enabled).toBe(false);
      expect(config.rules.strategy).toBe('timestamp');
      expect(config.rules.autoIncrement).toBe(false);
      expect(config.rules.majorVersionRules).toEqual(defaultConfig.rules.majorVersionRules);
    });

    it('should validate versioning rules', () => {
      const configWithRules = {
        ...defaultConfig,
        rules: {
          strategy: 'git' as const,
          majorVersionRules: ['custom_major_rule'],
          minorVersionRules: ['custom_minor_rule'],
          patchVersionRules: ['custom_patch_rule'],
          autoIncrement: true,
          enforceSequential: false,
          allowDowngrade: true,
        },
      };

      const config = validateConfig(configWithRules);
      expect(config.rules.strategy).toBe('git');
      expect(config.rules.majorVersionRules).toContain('custom_major_rule');
      expect(config.rules.allowDowngrade).toBe(true);
    });

    it('should validate storage configuration', () => {
      const configWithStorage = {
        ...defaultConfig,
        storage: {
          type: 'gcs' as const,
          path: 'custom-path',
          compression: false,
          encryption: true,
          retentionPolicy: {
            enabled: true,
            maxVersions: 20,
            maxAgeDays: 180,
          },
        },
      };

      const config = validateConfig(configWithStorage);
      expect(config.storage.type).toBe('gcs');
      expect(config.storage.path).toBe('custom-path');
      expect(config.storage.retentionPolicy.maxVersions).toBe(20);
    });

    it('should throw error for invalid storage configuration', () => {
      const invalidConfig = {
        ...defaultConfig,
        storage: {
          type: 'invalid' as any,
          path: '',
          compression: false,
          encryption: true,
          retentionPolicy: {
            enabled: true,
            maxVersions: 0,
            maxAgeDays: 0,
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should validate metadata configuration', () => {
      const configWithMetadata = {
        ...defaultConfig,
        metadata: {
          requiredFields: ['custom_field'],
          customFields: {
            priority: 'string',
            category: 'string',
          },
          validateSchema: true,
        },
      };

      const config = validateConfig(configWithMetadata);
      expect(config.metadata.requiredFields).toContain('custom_field');
      expect(config.metadata.customFields).toHaveProperty('priority');
    });

    it('should validate changelog configuration', () => {
      const configWithChangelog = {
        ...defaultConfig,
        changelog: {
          enabled: true,
          template: 'custom template',
          requiredSections: ['custom_section'],
        },
      };

      const config = validateConfig(configWithChangelog);
      expect(config.changelog.template).toBe('custom template');
      expect(config.changelog.requiredSections).toContain('custom_section');
    });

    it('should validate rollback configuration', () => {
      const configWithRollback = {
        ...defaultConfig,
        rollback: {
          enabled: true,
          automaticRollback: true,
          keepRollbackVersions: 5,
          requireApproval: false,
        },
      };

      const config = validateConfig(configWithRollback);
      expect(config.rollback.automaticRollback).toBe(true);
      expect(config.rollback.keepRollbackVersions).toBe(5);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should use environment variables when available', () => {
      process.env.VERSIONING_ENABLED = 'true';
      process.env.VERSIONING_STRATEGY = 'timestamp';
      process.env.AUTO_INCREMENT = 'false';
      process.env.ENFORCE_SEQUENTIAL = 'false';
      process.env.ALLOW_DOWNGRADE = 'true';
      process.env.STORAGE_TYPE = 'gcs';
      process.env.STORAGE_PATH = 'env-path';
      process.env.STORAGE_COMPRESSION = 'false';
      process.env.STORAGE_ENCRYPTION = 'true';
      process.env.RETENTION_ENABLED = 'true';
      process.env.MAX_VERSIONS = '15';
      process.env.MAX_AGE_DAYS = '90';
      process.env.ROLLBACK_ENABLED = 'true';
      process.env.AUTOMATIC_ROLLBACK = 'true';
      process.env.ROLLBACK_REQUIRE_APPROVAL = 'false';
      process.env.KEEP_ROLLBACK_VERSIONS = '4';

      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(true);
      expect(config.rules.strategy).toBe('timestamp');
      expect(config.rules.autoIncrement).toBe(false);
      expect(config.rules.enforceSequential).toBe(false);
      expect(config.rules.allowDowngrade).toBe(true);
      expect(config.storage.type).toBe('gcs');
      expect(config.storage.path).toBe('env-path');
      expect(config.storage.compression).toBe(false);
      expect(config.storage.encryption).toBe(true);
      expect(config.storage.retentionPolicy.maxVersions).toBe(15);
      expect(config.storage.retentionPolicy.maxAgeDays).toBe(90);
      expect(config.rollback.enabled).toBe(true);
      expect(config.rollback.automaticRollback).toBe(true);
      expect(config.rollback.requireApproval).toBe(false);
      expect(config.rollback.keepRollbackVersions).toBe(4);
    });

    it('should use default values when environment variables are not set', () => {
      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(defaultConfig.enabled);
      expect(config.rules.strategy).toBe(defaultConfig.rules.strategy);
      expect(config.storage.type).toBe(defaultConfig.storage.type);
      expect(config.storage.retentionPolicy).toEqual(defaultConfig.storage.retentionPolicy);
      expect(config.rollback).toEqual(defaultConfig.rollback);
    });

    it('should handle invalid environment variable values', () => {
      process.env.VERSIONING_STRATEGY = 'invalid';
      process.env.MAX_VERSIONS = 'invalid';
      process.env.KEEP_ROLLBACK_VERSIONS = '-1';

      const config = getEnvironmentConfig();
      expect(config.rules.strategy).toBe(defaultConfig.rules.strategy);
      expect(config.storage.retentionPolicy.maxVersions).toBe(defaultConfig.storage.retentionPolicy.maxVersions);
      expect(config.rollback.keepRollbackVersions).toBe(defaultConfig.rollback.keepRollbackVersions);
    });

    it('should validate environment config', () => {
      process.env.STORAGE_TYPE = 'invalid';
      expect(() => getEnvironmentConfig()).toThrow();
    });
  });
}); 