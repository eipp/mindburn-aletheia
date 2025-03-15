import { validateConfig, getEnvironmentConfig, defaultConfig } from '../monitoring-config';

describe('MonitoringConfig', () => {
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
        samplingRate: 0.5,
      };

      const config = validateConfig(partialConfig);
      expect(config).toEqual({
        ...defaultConfig,
        ...partialConfig,
      });
    });

    it('should validate metric configurations', () => {
      const configWithMetrics = {
        ...defaultConfig,
        metrics: {
          customMetric: {
            name: 'custom_metric',
            description: 'Custom metric description',
            unit: 'count',
            aggregation: 'avg' as const,
            thresholds: {
              warning: 10,
              critical: 20,
              comparisonOperator: '>' as const,
            },
            evaluationPeriod: 60,
            evaluationFrequency: 30,
          },
        },
      };

      const config = validateConfig(configWithMetrics);
      expect(config.metrics.customMetric).toBeDefined();
      expect(config.metrics.customMetric.name).toBe('custom_metric');
    });

    it('should validate alert configurations', () => {
      const configWithAlerts = {
        ...defaultConfig,
        alerts: {
          customAlert: {
            enabled: true,
            channels: ['webhook'],
            throttlingPeriod: 1800,
            groupingWindow: 300,
            severity: 'high' as const,
            autoResolve: true,
            customMessage: 'Custom alert message',
          },
        },
      };

      const config = validateConfig(configWithAlerts);
      expect(config.alerts.customAlert).toBeDefined();
      expect(config.alerts.customAlert.channels).toContain('webhook');
    });

    it('should throw error for invalid metric thresholds', () => {
      const invalidConfig = {
        ...defaultConfig,
        metrics: {
          invalidMetric: {
            name: 'invalid_metric',
            description: 'Invalid metric',
            unit: 'count',
            aggregation: 'invalid' as any,
            thresholds: {
              warning: -1,
              critical: -2,
              comparisonOperator: 'invalid' as any,
            },
            evaluationPeriod: 0,
            evaluationFrequency: 0,
          },
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should validate drift detection settings', () => {
      const configWithDrift = {
        ...defaultConfig,
        driftDetection: {
          enabled: true,
          algorithm: 'wasserstein' as const,
          threshold: 0.1,
          windowSize: 2000,
        },
      };

      const config = validateConfig(configWithDrift);
      expect(config.driftDetection.algorithm).toBe('wasserstein');
      expect(config.driftDetection.threshold).toBe(0.1);
    });

    it('should validate anomaly detection settings', () => {
      const configWithAnomalyDetection = {
        ...defaultConfig,
        anomalyDetection: {
          enabled: true,
          algorithm: 'dbscan' as const,
          sensitivity: 0.8,
          trainingPeriod: 300000,
        },
      };

      const config = validateConfig(configWithAnomalyDetection);
      expect(config.anomalyDetection.algorithm).toBe('dbscan');
      expect(config.anomalyDetection.sensitivity).toBe(0.8);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should use environment variables when available', () => {
      process.env.MONITORING_ENABLED = 'true';
      process.env.DATA_RETENTION_DAYS = '180';
      process.env.SAMPLING_RATE = '0.5';
      process.env.BASELINE_ENABLED = 'true';
      process.env.BASELINE_TRAINING_WINDOW = '1209600';
      process.env.DRIFT_DETECTION_ENABLED = 'true';
      process.env.DRIFT_THRESHOLD = '0.1';
      process.env.ANOMALY_DETECTION_ENABLED = 'true';
      process.env.ANOMALY_SENSITIVITY = '0.9';

      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(true);
      expect(config.dataRetentionDays).toBe(180);
      expect(config.samplingRate).toBe(0.5);
      expect(config.baselineConfig.enabled).toBe(true);
      expect(config.baselineConfig.trainingWindow).toBe(1209600);
      expect(config.driftDetection.enabled).toBe(true);
      expect(config.driftDetection.threshold).toBe(0.1);
      expect(config.anomalyDetection.enabled).toBe(true);
      expect(config.anomalyDetection.sensitivity).toBe(0.9);
    });

    it('should use default values when environment variables are not set', () => {
      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(defaultConfig.enabled);
      expect(config.dataRetentionDays).toBe(defaultConfig.dataRetentionDays);
      expect(config.samplingRate).toBe(defaultConfig.samplingRate);
      expect(config.baselineConfig.enabled).toBe(defaultConfig.baselineConfig.enabled);
      expect(config.driftDetection.enabled).toBe(defaultConfig.driftDetection.enabled);
      expect(config.anomalyDetection.enabled).toBe(defaultConfig.anomalyDetection.enabled);
    });

    it('should handle invalid environment variable values', () => {
      process.env.DATA_RETENTION_DAYS = 'invalid';
      process.env.SAMPLING_RATE = '2.0';
      process.env.DRIFT_THRESHOLD = 'invalid';

      const config = getEnvironmentConfig();
      expect(config.dataRetentionDays).toBe(defaultConfig.dataRetentionDays);
      expect(config.samplingRate).toBe(defaultConfig.samplingRate);
      expect(config.driftDetection.threshold).toBe(defaultConfig.driftDetection.threshold);
    });

    it('should validate environment config', () => {
      process.env.SAMPLING_RATE = '1.5';
      expect(() => getEnvironmentConfig()).toThrow();
    });
  });
}); 