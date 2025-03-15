import { createModelRegistry, CreateModelRegistryOptions } from '../create-model-registry';
import { ModelRegistry } from '../../model-registry';
import { ModelRegistryWithErrorHandling } from '../../services/model-registry-with-error-handling';
import * as errorConfig from '../../config/error-handling-config';
import * as registryConfig from '../../config/registry-config';

jest.mock('../../model-registry');
jest.mock('../../services/model-registry-with-error-handling');
jest.mock('../../config/error-handling-config');
jest.mock('../../config/registry-config');

describe('createModelRegistry', () => {
  const mockErrorConfig = {
    enabled: true,
    defaultHandler: {
      name: 'default',
      enabled: true,
      severity: 'medium',
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack'],
        throttlingPeriod: 3600,
      },
    },
    handlers: {},
    globalConfig: {
      logErrors: true,
      logStackTraces: true,
      errorReporting: {
        enabled: true,
        service: 'cloudwatch',
        environment: 'test',
        sampleRate: 1.0,
      },
      monitoring: {
        enabled: true,
        errorRateThreshold: 0.01,
        alertingEnabled: true,
      },
    },
    fallbackStrategy: {
      enabled: false,
      defaultResponse: null,
      logFallback: true,
    },
  };

  const mockRegistryConfig = {
    tableName: 'test-models',
    bucketName: 'test-artifacts',
    region: 'us-east-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (errorConfig.getEnvironmentConfig as jest.Mock).mockReturnValue(mockErrorConfig);
    (errorConfig.validateConfig as jest.Mock).mockImplementation(config => config);
    (registryConfig.getEnvironmentConfig as jest.Mock).mockReturnValue(mockRegistryConfig);
    (registryConfig.validateConfig as jest.Mock).mockImplementation(config => config);
  });

  it('should create ModelRegistry without error handling when useErrorHandling is false', async () => {
    const options: CreateModelRegistryOptions = {
      useErrorHandling: false,
    };

    const registry = await createModelRegistry(options);

    expect(registry).toBeInstanceOf(ModelRegistry);
    expect(ModelRegistryWithErrorHandling).not.toHaveBeenCalled();
    expect(registryConfig.validateConfig).toHaveBeenCalledWith(mockRegistryConfig);
  });

  it('should create ModelRegistryWithErrorHandling by default', async () => {
    const registry = await createModelRegistry();

    expect(registry).toBeInstanceOf(ModelRegistryWithErrorHandling);
    expect(errorConfig.validateConfig).toHaveBeenCalledWith(mockErrorConfig);
    expect(registryConfig.validateConfig).toHaveBeenCalledWith(mockRegistryConfig);
  });

  it('should apply error config overrides', async () => {
    const errorOverrides = {
      enabled: false,
      globalConfig: {
        logErrors: false,
      },
    };

    await createModelRegistry({
      errorConfigOverrides: errorOverrides,
    });

    expect(errorConfig.validateConfig).toHaveBeenCalledWith({
      ...mockErrorConfig,
      ...errorOverrides,
    });
  });

  it('should apply registry config overrides', async () => {
    const registryOverrides = {
      tableName: 'custom-table',
      region: 'eu-west-1',
    };

    await createModelRegistry({
      registryConfigOverrides: registryOverrides,
    });

    expect(registryConfig.validateConfig).toHaveBeenCalledWith({
      ...mockRegistryConfig,
      ...registryOverrides,
    });
  });

  it('should handle validation errors for error config', async () => {
    const invalidErrorConfig = {
      enabled: true,
      defaultHandler: {
        severity: 'invalid',
      },
    };

    (errorConfig.validateConfig as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid error config');
    });

    await expect(createModelRegistry({
      errorConfigOverrides: invalidErrorConfig,
    })).rejects.toThrow('Invalid error config');
  });

  it('should handle validation errors for registry config', async () => {
    const invalidRegistryConfig = {
      tableName: '',
    };

    (registryConfig.validateConfig as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid registry config');
    });

    await expect(createModelRegistry({
      registryConfigOverrides: invalidRegistryConfig,
    })).rejects.toThrow('Invalid registry config');
  });

  it('should create ModelRegistryWithErrorHandling with both config overrides', async () => {
    const errorOverrides = {
      globalConfig: {
        logErrors: false,
        errorReporting: {
          service: 'sentry',
        },
      },
    };

    const registryOverrides = {
      tableName: 'custom-table',
    };

    const registry = await createModelRegistry({
      errorConfigOverrides: errorOverrides,
      registryConfigOverrides: registryOverrides,
    });

    expect(registry).toBeInstanceOf(ModelRegistryWithErrorHandling);
    expect(errorConfig.validateConfig).toHaveBeenCalledWith({
      ...mockErrorConfig,
      ...errorOverrides,
    });
    expect(registryConfig.validateConfig).toHaveBeenCalledWith({
      ...mockRegistryConfig,
      ...registryOverrides,
    });
  });
}); 