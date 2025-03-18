import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { SNS } from '@aws-sdk/client-sns';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('MonitoringManager');

export class MonitoringManager {
  constructor(
    private readonly cloudwatch: CloudWatch,
    private readonly sns: SNS,
    private readonly config: {
      environment: string;
      alarmTopicArn: string;
      namespace: string;
    }
  ) {}

  async putMetric(
    name: string,
    value: number,
    unit: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent',
    dimensions: Record<string, string>
  ) {
    try {
      await this.cloudwatch.putMetricData({
        Namespace: this.config.namespace,
        MetricData: [
          {
            MetricName: name,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({
              Name,
              Value
            }))
          }
        ]
      });
    } catch (error) {
      logger.error('Failed to put metric', { error, name, value });
      throw error;
    }
  }

  async createAlarm(params: {
    name: string;
    description: string;
    metric: string;
    threshold: number;
    evaluationPeriods: number;
    datapointsToAlarm: number;
    comparisonOperator:
      | 'GreaterThanThreshold'
      | 'LessThanThreshold'
      | 'GreaterThanOrEqualToThreshold'
      | 'LessThanOrEqualToThreshold';
    dimensions: Record<string, string>;
  }) {
    try {
      await this.cloudwatch.putMetricAlarm({
        AlarmName: `${this.config.environment}-${params.name}`,
        AlarmDescription: params.description,
        MetricName: params.metric,
        Namespace: this.config.namespace,
        Statistic: 'Average',
        Dimensions: Object.entries(params.dimensions).map(([Name, Value]) => ({
          Name,
          Value
        })),
        Period: 300, // 5 minutes
        EvaluationPeriods: params.evaluationPeriods,
        DatapointsToAlarm: params.datapointsToAlarm,
        Threshold: params.threshold,
        ComparisonOperator: params.comparisonOperator,
        TreatMissingData: 'missing',
        AlarmActions: [this.config.alarmTopicArn],
        OKActions: [this.config.alarmTopicArn],
        Tags: [
          {
            Key: 'Environment',
            Value: this.config.environment
          },
          {
            Key: 'Service',
            Value: 'verification-engine'
          }
        ]
      });
    } catch (error) {
      logger.error('Failed to create alarm', { error, ...params });
      throw error;
    }
  }

  // Pre-configured alarms for common metrics
  async setupDefaultAlarms() {
    await Promise.all([
      // API Latency
      this.createAlarm({
        name: 'api-high-latency',
        description: 'API latency is above threshold',
        metric: 'ApiLatency',
        threshold: 1000, // 1 second
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator: 'GreaterThanThreshold',
        dimensions: { Service: 'verification-engine' }
      }),

      // Error Rate
      this.createAlarm({
        name: 'high-error-rate',
        description: 'Error rate is above threshold',
        metric: 'ErrorCount',
        threshold: 10,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator: 'GreaterThanThreshold',
        dimensions: { Service: 'verification-engine' }
      }),

      // Worker Registration Rate
      this.createAlarm({
        name: 'low-worker-registration',
        description: 'Worker registration rate is below threshold',
        metric: 'WorkerRegistrationCount',
        threshold: 5,
        evaluationPeriods: 12, // 1 hour
        datapointsToAlarm: 12,
        comparisonOperator: 'LessThanThreshold',
        dimensions: { Service: 'verification-engine' }
      }),

      // Verification Success Rate
      this.createAlarm({
        name: 'low-verification-success',
        description: 'Verification success rate is below threshold',
        metric: 'VerificationSuccessRate',
        threshold: 95,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        comparisonOperator: 'LessThanThreshold',
        dimensions: { Service: 'verification-engine' }
      })
    ]);
  }

  // Common metric publishers
  async recordApiLatency(endpoint: string, latency: number) {
    await this.putMetric('ApiLatency', latency, 'Milliseconds', {
      Service: 'verification-engine',
      Endpoint: endpoint
    });
  }

  async recordError(component: string) {
    await this.putMetric('ErrorCount', 1, 'Count', {
      Service: 'verification-engine',
      Component: component
    });
  }

  async recordWorkerRegistration() {
    await this.putMetric('WorkerRegistrationCount', 1, 'Count', {
      Service: 'verification-engine'
    });
  }

  async recordVerificationResult(success: boolean) {
    await this.putMetric('VerificationSuccessRate', success ? 100 : 0, 'Percent', {
      Service: 'verification-engine'
    });
  }

  async recordDatabaseLatency(operation: string, latency: number) {
    await this.putMetric('DatabaseLatency', latency, 'Milliseconds', {
      Service: 'verification-engine',
      Operation: operation
    });
  }

  async recordQueueSize(queueName: string, size: number) {
    await this.putMetric('QueueSize', size, 'Count', {
      Service: 'verification-engine',
      Queue: queueName
    });
  }
} 