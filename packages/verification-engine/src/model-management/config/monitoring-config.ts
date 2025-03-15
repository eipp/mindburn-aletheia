import { z } from 'zod';

export const MetricThresholdSchema = z.object({
  warning: z.number(),
  critical: z.number(),
  comparisonOperator: z.enum(['>', '<', '>=', '<=', '=']),
});

export const MetricConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  unit: z.string(),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count', 'p90', 'p95', 'p99']),
  thresholds: MetricThresholdSchema,
  evaluationPeriod: z.number().min(1),
  evaluationFrequency: z.number().min(1),
});

export const AlertConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.string()),
  throttlingPeriod: z.number().min(0),
  groupingWindow: z.number().min(0),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  autoResolve: z.boolean(),
  customMessage: z.string().optional(),
});

export const MonitoringConfigSchema = z.object({
  enabled: z.boolean(),
  metrics: z.record(MetricConfigSchema),
  alerts: z.record(AlertConfigSchema),
  dataRetentionDays: z.number().min(1),
  samplingRate: z.number().min(0).max(1),
  baselineConfig: z.object({
    enabled: z.boolean(),
    trainingWindow: z.number().min(1),
    updateFrequency: z.number().min(1),
    minDataPoints: z.number().min(1),
  }),
  driftDetection: z.object({
    enabled: z.boolean(),
    algorithm: z.enum(['ks_test', 'chi_squared', 'wasserstein']),
    threshold: z.number().min(0).max(1),
    windowSize: z.number().min(1),
  }),
  anomalyDetection: z.object({
    enabled: z.boolean(),
    algorithm: z.enum(['isolation_forest', 'dbscan', 'mad']),
    sensitivity: z.number().min(0).max(1),
    trainingPeriod: z.number().min(1),
  }),
  reporting: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
    recipients: z.array(z.string()),
    format: z.enum(['pdf', 'html', 'json']),
  }),
});

export type MetricThreshold = z.infer<typeof MetricThresholdSchema>;
export type MetricConfig = z.infer<typeof MetricConfigSchema>;
export type AlertConfig = z.infer<typeof AlertConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

export const defaultConfig: MonitoringConfig = {
  enabled: true,
  metrics: {
    latency: {
      name: 'request_latency',
      description: 'Model inference latency',
      unit: 'milliseconds',
      aggregation: 'p95',
      thresholds: {
        warning: 100,
        critical: 200,
        comparisonOperator: '>',
      },
      evaluationPeriod: 300,
      evaluationFrequency: 60,
    },
    errorRate: {
      name: 'error_rate',
      description: 'Model error rate',
      unit: 'percentage',
      aggregation: 'avg',
      thresholds: {
        warning: 0.01,
        critical: 0.05,
        comparisonOperator: '>',
      },
      evaluationPeriod: 300,
      evaluationFrequency: 60,
    },
    throughput: {
      name: 'requests_per_second',
      description: 'Model request throughput',
      unit: 'count',
      aggregation: 'sum',
      thresholds: {
        warning: 1000,
        critical: 2000,
        comparisonOperator: '>',
      },
      evaluationPeriod: 300,
      evaluationFrequency: 60,
    },
  },
  alerts: {
    latencyAlert: {
      enabled: true,
      channels: ['slack', 'email'],
      throttlingPeriod: 3600,
      groupingWindow: 300,
      severity: 'high',
      autoResolve: true,
    },
    errorAlert: {
      enabled: true,
      channels: ['slack', 'email', 'pagerduty'],
      throttlingPeriod: 1800,
      groupingWindow: 300,
      severity: 'critical',
      autoResolve: false,
    },
  },
  dataRetentionDays: 90,
  samplingRate: 1.0,
  baselineConfig: {
    enabled: true,
    trainingWindow: 604800, // 1 week in seconds
    updateFrequency: 86400, // 1 day in seconds
    minDataPoints: 1000,
  },
  driftDetection: {
    enabled: true,
    algorithm: 'ks_test',
    threshold: 0.05,
    windowSize: 1000,
  },
  anomalyDetection: {
    enabled: true,
    algorithm: 'isolation_forest',
    sensitivity: 0.95,
    trainingPeriod: 604800, // 1 week in seconds
  },
  reporting: {
    enabled: true,
    frequency: 'daily',
    recipients: ['ml-team@company.com'],
    format: 'html',
  },
};

export function validateConfig(config: Partial<MonitoringConfig>): MonitoringConfig {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    metrics: {
      ...defaultConfig.metrics,
      ...config.metrics,
    },
    alerts: {
      ...defaultConfig.alerts,
      ...config.alerts,
    },
    baselineConfig: {
      ...defaultConfig.baselineConfig,
      ...config.baselineConfig,
    },
    driftDetection: {
      ...defaultConfig.driftDetection,
      ...config.driftDetection,
    },
    anomalyDetection: {
      ...defaultConfig.anomalyDetection,
      ...config.anomalyDetection,
    },
    reporting: {
      ...defaultConfig.reporting,
      ...config.reporting,
    },
  };
  return MonitoringConfigSchema.parse(mergedConfig);
}

export function getEnvironmentConfig(): MonitoringConfig {
  const envConfig: Partial<MonitoringConfig> = {
    enabled: process.env.MONITORING_ENABLED === 'true',
    dataRetentionDays: process.env.DATA_RETENTION_DAYS 
      ? parseInt(process.env.DATA_RETENTION_DAYS, 10)
      : defaultConfig.dataRetentionDays,
    samplingRate: process.env.SAMPLING_RATE
      ? parseFloat(process.env.SAMPLING_RATE)
      : defaultConfig.samplingRate,
    baselineConfig: {
      enabled: process.env.BASELINE_ENABLED === 'true',
      trainingWindow: process.env.BASELINE_TRAINING_WINDOW
        ? parseInt(process.env.BASELINE_TRAINING_WINDOW, 10)
        : defaultConfig.baselineConfig.trainingWindow,
    },
    driftDetection: {
      enabled: process.env.DRIFT_DETECTION_ENABLED === 'true',
      threshold: process.env.DRIFT_THRESHOLD
        ? parseFloat(process.env.DRIFT_THRESHOLD)
        : defaultConfig.driftDetection.threshold,
    },
    anomalyDetection: {
      enabled: process.env.ANOMALY_DETECTION_ENABLED === 'true',
      sensitivity: process.env.ANOMALY_SENSITIVITY
        ? parseFloat(process.env.ANOMALY_SENSITIVITY)
        : defaultConfig.anomalyDetection.sensitivity,
    },
  };

  return validateConfig(envConfig);
} 