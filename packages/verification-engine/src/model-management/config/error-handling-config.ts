import { z } from 'zod';

export const ErrorSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ErrorHandlerConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  severity: ErrorSeveritySchema,
  retryConfig: z.object({
    maxAttempts: z.number().min(1),
    backoffMultiplier: z.number().min(1),
    initialDelayMs: z.number().min(0),
  }),
  notificationConfig: z.object({
    enabled: z.boolean(),
    channels: z.array(z.string()),
    throttlingPeriod: z.number().min(0),
  }),
});

export const ErrorHandlingConfigSchema = z.object({
  enabled: z.boolean(),
  defaultHandler: ErrorHandlerConfigSchema,
  handlers: z.record(ErrorHandlerConfigSchema),
  globalConfig: z.object({
    logErrors: z.boolean(),
    logStackTraces: z.boolean(),
    errorReporting: z.object({
      enabled: z.boolean(),
      service: z.enum(['sentry', 'rollbar', 'cloudwatch']),
      environment: z.string(),
      sampleRate: z.number().min(0).max(1),
    }),
    monitoring: z.object({
      enabled: z.boolean(),
      errorRateThreshold: z.number().min(0),
      alertingEnabled: z.boolean(),
    }),
  }),
  fallbackStrategy: z.object({
    enabled: z.boolean(),
    defaultResponse: z.any(),
    logFallback: z.boolean(),
  }),
});

export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;
export type ErrorHandlerConfig = z.infer<typeof ErrorHandlerConfigSchema>;
export type ErrorHandlingConfig = z.infer<typeof ErrorHandlingConfigSchema>;

export const defaultConfig: ErrorHandlingConfig = {
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
  handlers: {
    modelRegistration: {
      name: 'model_registration',
      enabled: true,
      severity: 'high',
      retryConfig: {
        maxAttempts: 5,
        backoffMultiplier: 2,
        initialDelayMs: 2000,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack', 'email'],
        throttlingPeriod: 1800,
      },
    },
    modelDeployment: {
      name: 'model_deployment',
      enabled: true,
      severity: 'critical',
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelayMs: 5000,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack', 'email', 'pagerduty'],
        throttlingPeriod: 900,
      },
    },
    modelInference: {
      name: 'model_inference',
      enabled: true,
      severity: 'high',
      retryConfig: {
        maxAttempts: 2,
        backoffMultiplier: 2,
        initialDelayMs: 500,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack'],
        throttlingPeriod: 300,
      },
    },
  },
  globalConfig: {
    logErrors: true,
    logStackTraces: true,
    errorReporting: {
      enabled: true,
      service: 'cloudwatch',
      environment: 'production',
      sampleRate: 1.0,
    },
    monitoring: {
      enabled: true,
      errorRateThreshold: 0.01,
      alertingEnabled: true,
    },
  },
  fallbackStrategy: {
    enabled: true,
    defaultResponse: null,
    logFallback: true,
  },
};

export function validateConfig(config: Partial<ErrorHandlingConfig>): ErrorHandlingConfig {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    defaultHandler: {
      ...defaultConfig.defaultHandler,
      ...config.defaultHandler,
    },
    handlers: {
      ...defaultConfig.handlers,
      ...config.handlers,
    },
    globalConfig: {
      ...defaultConfig.globalConfig,
      ...config.globalConfig,
      errorReporting: {
        ...defaultConfig.globalConfig.errorReporting,
        ...config.globalConfig?.errorReporting,
      },
      monitoring: {
        ...defaultConfig.globalConfig.monitoring,
        ...config.globalConfig?.monitoring,
      },
    },
    fallbackStrategy: {
      ...defaultConfig.fallbackStrategy,
      ...config.fallbackStrategy,
    },
  };
  return ErrorHandlingConfigSchema.parse(mergedConfig);
}

export function getEnvironmentConfig(): ErrorHandlingConfig {
  const envConfig: Partial<ErrorHandlingConfig> = {
    enabled: process.env.ERROR_HANDLING_ENABLED === 'true',
    globalConfig: {
      logErrors: process.env.LOG_ERRORS === 'true',
      logStackTraces: process.env.LOG_STACK_TRACES === 'true',
      errorReporting: {
        enabled: process.env.ERROR_REPORTING_ENABLED === 'true',
        service: (process.env.ERROR_REPORTING_SERVICE as ErrorHandlingConfig['globalConfig']['errorReporting']['service']) || defaultConfig.globalConfig.errorReporting.service,
        environment: process.env.NODE_ENV || defaultConfig.globalConfig.errorReporting.environment,
        sampleRate: process.env.ERROR_SAMPLING_RATE
          ? parseFloat(process.env.ERROR_SAMPLING_RATE)
          : defaultConfig.globalConfig.errorReporting.sampleRate,
      },
      monitoring: {
        enabled: process.env.ERROR_MONITORING_ENABLED === 'true',
        errorRateThreshold: process.env.ERROR_RATE_THRESHOLD
          ? parseFloat(process.env.ERROR_RATE_THRESHOLD)
          : defaultConfig.globalConfig.monitoring.errorRateThreshold,
        alertingEnabled: process.env.ERROR_ALERTING_ENABLED === 'true',
      },
    },
    fallbackStrategy: {
      enabled: process.env.FALLBACK_STRATEGY_ENABLED === 'true',
      logFallback: process.env.LOG_FALLBACK === 'true',
    },
  };

  return validateConfig(envConfig);
} 