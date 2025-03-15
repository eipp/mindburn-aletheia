import { validateConfig, getEnvironmentConfig, defaultConfig, ErrorHandlingConfig } from '../error-handling-config';

describe('validateConfig', () => {
  it('should validate a complete configuration', () => {
    const config = defaultConfig;
    expect(validateConfig(config)).toEqual(config);
  });

  it('should merge partial configuration with defaults', () => {
    const partialConfig: Partial<ErrorHandlingConfig> = {
      enabled: false,
      defaultHandler: {
        name: 'custom',
        enabled: false,
        severity: 'high',
        retryConfig: {
          maxAttempts: 5,
          backoffMultiplier: 3,
          initialDelayMs: 2000,
        },
        notificationConfig: {
          enabled: true,
          channels: ['email'],
          throttlingPeriod: 1800,
        },
      },
    };

    const result = validateConfig(partialConfig);
    expect(result.enabled).toBe(false);
    expect(result.defaultHandler.name).toBe('custom');
    expect(result.defaultHandler.severity).toBe('high');
    expect(result.defaultHandler.retryConfig.maxAttempts).toBe(5);
    expect(result.handlers).toEqual(defaultConfig.handlers);
  });

  it('should validate handler configurations', () => {
    const config: Partial<ErrorHandlingConfig> = {
      handlers: {
        customHandler: {
          name: 'custom',
          enabled: true,
          severity: 'critical',
          retryConfig: {
            maxAttempts: 1,
            backoffMultiplier: 1,
            initialDelayMs: 0,
          },
          notificationConfig: {
            enabled: true,
            channels: ['slack', 'email'],
            throttlingPeriod: 0,
          },
        },
      },
    };

    const result = validateConfig(config);
    expect(result.handlers.customHandler).toBeDefined();
    expect(result.handlers.customHandler.severity).toBe('critical');
  });

  it('should throw error for invalid retry configuration', () => {
    const config: Partial<ErrorHandlingConfig> = {
      defaultHandler: {
        name: 'invalid',
        enabled: true,
        severity: 'medium',
        retryConfig: {
          maxAttempts: 0,
          backoffMultiplier: 0,
          initialDelayMs: -1,
        },
        notificationConfig: {
          enabled: true,
          channels: [],
          throttlingPeriod: 3600,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow();
  });

  it('should validate error reporting configuration', () => {
    const config: Partial<ErrorHandlingConfig> = {
      globalConfig: {
        logErrors: true,
        logStackTraces: false,
        errorReporting: {
          enabled: true,
          service: 'sentry',
          environment: 'staging',
          sampleRate: 0.5,
        },
        monitoring: {
          enabled: true,
          errorRateThreshold: 0.05,
          alertingEnabled: true,
        },
      },
    };

    const result = validateConfig(config);
    expect(result.globalConfig.errorReporting.service).toBe('sentry');
    expect(result.globalConfig.errorReporting.sampleRate).toBe(0.5);
  });

  it('should throw error for invalid sample rate', () => {
    const config: Partial<ErrorHandlingConfig> = {
      globalConfig: {
        logErrors: true,
        logStackTraces: true,
        errorReporting: {
          enabled: true,
          service: 'cloudwatch',
          environment: 'production',
          sampleRate: 1.5,
        },
        monitoring: {
          enabled: true,
          errorRateThreshold: 0.01,
          alertingEnabled: true,
        },
      },
    };

    expect(() => validateConfig(config)).toThrow();
  });
});

describe('getEnvironmentConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use environment variables when available', () => {
    process.env.ERROR_HANDLING_ENABLED = 'false';
    process.env.LOG_ERRORS = 'false';
    process.env.ERROR_REPORTING_SERVICE = 'sentry';
    process.env.NODE_ENV = 'staging';
    process.env.ERROR_SAMPLING_RATE = '0.5';
    process.env.ERROR_RATE_THRESHOLD = '0.02';
    process.env.ERROR_ALERTING_ENABLED = 'false';

    const config = getEnvironmentConfig();
    expect(config.enabled).toBe(false);
    expect(config.globalConfig.logErrors).toBe(false);
    expect(config.globalConfig.errorReporting.service).toBe('sentry');
    expect(config.globalConfig.errorReporting.environment).toBe('staging');
    expect(config.globalConfig.errorReporting.sampleRate).toBe(0.5);
    expect(config.globalConfig.monitoring.errorRateThreshold).toBe(0.02);
    expect(config.globalConfig.monitoring.alertingEnabled).toBe(false);
  });

  it('should fall back to default values when environment variables are not set', () => {
    const config = getEnvironmentConfig();
    expect(config.enabled).toBe(defaultConfig.enabled);
    expect(config.globalConfig.errorReporting.service).toBe(defaultConfig.globalConfig.errorReporting.service);
    expect(config.globalConfig.errorReporting.sampleRate).toBe(defaultConfig.globalConfig.errorReporting.sampleRate);
  });

  it('should handle invalid environment variable values', () => {
    process.env.ERROR_SAMPLING_RATE = 'invalid';
    process.env.ERROR_RATE_THRESHOLD = 'invalid';

    const config = getEnvironmentConfig();
    expect(config.globalConfig.errorReporting.sampleRate).toBe(defaultConfig.globalConfig.errorReporting.sampleRate);
    expect(config.globalConfig.monitoring.errorRateThreshold).toBe(defaultConfig.globalConfig.monitoring.errorRateThreshold);
  });

  it('should validate environment configuration', () => {
    process.env.ERROR_SAMPLING_RATE = '2.0';
    expect(() => getEnvironmentConfig()).toThrow();
  });
}); 