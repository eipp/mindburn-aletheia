import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator,
} from '@mindburn/shared';

export interface MetricConfig {
  name: string;
  description: string;
  unit: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  thresholds: {
    warning: number;
    critical: number;
    comparisonOperator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  };
  evaluationPeriod: number;
  evaluationFrequency: number;
}

export interface AlertConfig {
  enabled: boolean;
  channels: string[];
  throttlingPeriod: number;
  groupingWindow: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolve: boolean;
  customMessage?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: Record<string, MetricConfig>;
  alerts: Record<string, AlertConfig>;
  dataRetentionDays: number;
  samplingRate: number;
  baselineConfig: {
    enabled: boolean;
    trainingWindow: number;
    updateFrequency: number;
    minDataPoints: number;
  };
  driftDetection: {
    enabled: boolean;
    algorithm: 'ks_test' | 'chi_squared' | 'wasserstein';
    threshold: number;
    windowSize: number;
  };
  anomalyDetection: {
    enabled: boolean;
    algorithm: 'isolation_forest' | 'dbscan' | 'mad';
    sensitivity: number;
    trainingPeriod: number;
  };
  reporting: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    format: 'pdf' | 'html' | 'json';
  };
}

const defaultConfig: MonitoringConfig = {
  enabled: true,
  metrics: {},
  alerts: {},
  dataRetentionDays: 30,
  samplingRate: 1.0,
  baselineConfig: {
    enabled: true,
    trainingWindow: 7 * 24 * 60 * 60, // 7 days in seconds
    updateFrequency: 24 * 60 * 60, // 1 day in seconds
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
    trainingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
  },
  reporting: {
    enabled: true,
    frequency: 'daily',
    recipients: [],
    format: 'pdf',
  },
};

const MetricConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  unit: z.string(),
  aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count']),
  thresholds: z.object({
    warning: z.number(),
    critical: z.number(),
    comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  }),
  evaluationPeriod: z.number().min(1),
  evaluationFrequency: z.number().min(1),
});

const AlertConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.string()),
  throttlingPeriod: z.number().min(0),
  groupingWindow: z.number().min(0),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  autoResolve: z.boolean(),
  customMessage: z.string().optional(),
});

const MonitoringSchema = z.object({
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

const envMap: Record<string, string> = {
  enabled: 'MONITORING_ENABLED',
  dataRetentionDays: 'DATA_RETENTION_DAYS',
  samplingRate: 'SAMPLING_RATE',
  'baselineConfig.enabled': 'BASELINE_ENABLED',
  'baselineConfig.trainingWindow': 'BASELINE_TRAINING_WINDOW',
  'baselineConfig.updateFrequency': 'BASELINE_UPDATE_FREQUENCY',
  'baselineConfig.minDataPoints': 'BASELINE_MIN_DATA_POINTS',
  'driftDetection.enabled': 'DRIFT_DETECTION_ENABLED',
  'driftDetection.algorithm': 'DRIFT_ALGORITHM',
  'driftDetection.threshold': 'DRIFT_THRESHOLD',
  'driftDetection.windowSize': 'DRIFT_WINDOW_SIZE',
  'anomalyDetection.enabled': 'ANOMALY_DETECTION_ENABLED',
  'anomalyDetection.algorithm': 'ANOMALY_ALGORITHM',
  'anomalyDetection.sensitivity': 'ANOMALY_SENSITIVITY',
  'anomalyDetection.trainingPeriod': 'ANOMALY_TRAINING_PERIOD',
  'reporting.enabled': 'REPORTING_ENABLED',
  'reporting.frequency': 'REPORTING_FREQUENCY',
  'reporting.format': 'REPORTING_FORMAT',
};

export const validateConfig = createConfigValidator<MonitoringConfig>({
  schema: MonitoringSchema,
  defaultConfig,
  transformers: [createEnvironmentTransformer(envMap)],
  validators: [
    createSecurityValidator(['reporting.recipients']),
    createPerformanceValidator({
      dataRetentionDays: 90,
      'baselineConfig.minDataPoints': 5000,
      'driftDetection.windowSize': 5000,
      'anomalyDetection.trainingPeriod': 30 * 24 * 60 * 60, // 30 days
    }),
  ],
});

export function getConfig(): MonitoringConfig {
  return validateConfig({});
}
