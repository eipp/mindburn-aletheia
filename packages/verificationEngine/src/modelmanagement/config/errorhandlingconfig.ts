import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator
} from '@mindburn/shared';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

const ErrorSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export interface ErrorHandlingConfig {
  enabled: boolean;
  defaultHandler: ErrorHandlerConfig;
  handlers: Record<string, ErrorHandlerConfig>;
  globalConfig: {
    logErrors: boolean;
    logStackTraces: boolean;
    errorReporting: {
      enabled: boolean;
      service: 'sentry' | 'rollbar' | 'cloudwatch';
      environment: string;
      sampleRate: number;
    };
    monitoring: {
      enabled: boolean;
      errorRateThreshold: number;
      alertingEnabled: boolean;
    };
  };
  fallbackStrategy: {
    enabled: boolean;
    defaultResponse: any;
    logFallback: boolean;
  };
}

export interface ErrorHandlerConfig {
  name: string;
  enabled: boolean;
  severity: ErrorSeverity;
  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
  notificationConfig: {
    enabled: boolean;
    channels: string[];
    throttlingPeriod: number;
  };
}

const defaultConfig: ErrorHandlingConfig = {
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
      channels: ['email'],
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
      environment: 'development',
      sampleRate: 1.0,
    },
    monitoring: {
      enabled: true,
      errorRateThreshold: 0.05,
      alertingEnabled: true,
    },
  },
  fallbackStrategy: {
    enabled: true,
    defaultResponse: null,
    logFallback: true,
  },
};

const ErrorHandlerSchema = z.object({
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

const ErrorHandlingSchema = z.object({
  enabled: z.boolean(),
  defaultHandler: ErrorHandlerSchema,
  handlers: z.record(ErrorHandlerSchema),
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

const envMap: Record<string, string> = {
  enabled: 'ERROR_HANDLING_ENABLED',
  'defaultHandler.enabled': 'DEFAULT_HANDLER_ENABLED',
  'defaultHandler.severity': 'DEFAULT_HANDLER_SEVERITY',
  'defaultHandler.retryConfig.maxAttempts': 'DEFAULT_MAX_RETRY_ATTEMPTS',
  'defaultHandler.retryConfig.backoffMultiplier': 'DEFAULT_BACKOFF_MULTIPLIER',
  'defaultHandler.retryConfig.initialDelayMs': 'DEFAULT_INITIAL_DELAY_MS',
  'defaultHandler.notificationConfig.enabled': 'DEFAULT_NOTIFICATIONS_ENABLED',
  'defaultHandler.notificationConfig.throttlingPeriod': 'DEFAULT_THROTTLING_PERIOD',
  'globalConfig.logErrors': 'LOG_ERRORS',
  'globalConfig.logStackTraces': 'LOG_STACK_TRACES',
  'globalConfig.errorReporting.enabled': 'ERROR_REPORTING_ENABLED',
  'globalConfig.errorReporting.service': 'ERROR_REPORTING_SERVICE',
  'globalConfig.errorReporting.environment': 'NODE_ENV',
  'globalConfig.errorReporting.sampleRate': 'ERROR_SAMPLING_RATE',
  'globalConfig.monitoring.enabled': 'ERROR_MONITORING_ENABLED',
  'globalConfig.monitoring.errorRateThreshold': 'ERROR_RATE_THRESHOLD',
  'globalConfig.monitoring.alertingEnabled': 'ERROR_ALERTING_ENABLED',
  'fallbackStrategy.enabled': 'FALLBACK_STRATEGY_ENABLED',
  'fallbackStrategy.logFallback': 'LOG_FALLBACK'
};

export const validateConfig = createConfigValidator<ErrorHandlingConfig>({
  schema: ErrorHandlingSchema,
  defaultConfig,
  transformers: [
    createEnvironmentTransformer(envMap)
  ],
  validators: [
    createSecurityValidator(['globalConfig.errorReporting.service']),
    createPerformanceValidator({
      'defaultHandler.retryConfig.maxAttempts': 5,
      'defaultHandler.notificationConfig.throttlingPeriod': 7200
    })
  ]
});

export function getConfig(): ErrorHandlingConfig {
  return validateConfig({});
} 