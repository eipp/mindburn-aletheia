import { CloudWatch } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('worker-bot:monitoring');
const cloudwatch = new CloudWatch();

export class MonitoringService {
  private readonly NAMESPACE = 'WorkerBot';
  private readonly ALARM_PREFIX = 'WorkerBot-';

  async createCloudWatchAlarms(): Promise<void> {
    try {
      // High Fraud Detection Rate Alarm
      await cloudwatch
        .putMetricAlarm({
          AlarmName: `${this.ALARM_PREFIX}HighFraudDetectionRate`,
          AlarmDescription: 'Alert when fraud detections exceed threshold',
          MetricName: 'FraudDetections',
          Namespace: this.NAMESPACE,
          Statistic: 'Sum',
          Period: 300, // 5 minutes
          EvaluationPeriods: 1,
          Threshold: 10,
          ComparisonOperator: 'GreaterThanThreshold',
          ActionsEnabled: true,
          AlarmActions: [process.env.ALARM_SNS_TOPIC!],
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.STAGE || 'development',
            },
          ],
        })
        .promise();

      // Low Quality Submissions Alarm
      await cloudwatch
        .putMetricAlarm({
          AlarmName: `${this.ALARM_PREFIX}LowQualitySubmissions`,
          AlarmDescription: 'Alert when submission quality drops below threshold',
          MetricName: 'SubmissionQualityScore',
          Namespace: this.NAMESPACE,
          Statistic: 'Average',
          Period: 900, // 15 minutes
          EvaluationPeriods: 1,
          Threshold: 0.6,
          ComparisonOperator: 'LessThanThreshold',
          ActionsEnabled: true,
          AlarmActions: [process.env.ALARM_SNS_TOPIC!],
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.STAGE || 'development',
            },
          ],
        })
        .promise();

      // High Error Rate Alarm
      await cloudwatch
        .putMetricAlarm({
          AlarmName: `${this.ALARM_PREFIX}HighErrorRate`,
          AlarmDescription: 'Alert when error rate exceeds threshold',
          MetricName: 'ErrorCount',
          Namespace: this.NAMESPACE,
          Statistic: 'Sum',
          Period: 300, // 5 minutes
          EvaluationPeriods: 1,
          Threshold: 5,
          ComparisonOperator: 'GreaterThanThreshold',
          ActionsEnabled: true,
          AlarmActions: [process.env.ALARM_SNS_TOPIC!],
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.STAGE || 'development',
            },
          ],
        })
        .promise();

      // Task Processing Delay Alarm
      await cloudwatch
        .putMetricAlarm({
          AlarmName: `${this.ALARM_PREFIX}TaskProcessingDelay`,
          AlarmDescription: 'Alert when task processing time exceeds threshold',
          MetricName: 'TaskProcessingTime',
          Namespace: this.NAMESPACE,
          Statistic: 'Average',
          Period: 300, // 5 minutes
          EvaluationPeriods: 2,
          Threshold: 30, // 30 seconds
          ComparisonOperator: 'GreaterThanThreshold',
          ActionsEnabled: true,
          AlarmActions: [process.env.ALARM_SNS_TOPIC!],
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.STAGE || 'development',
            },
          ],
        })
        .promise();

      logger.info('CloudWatch alarms created successfully');
    } catch (error) {
      logger.error('Error creating CloudWatch alarms:', error);
      throw error;
    }
  }

  async publishMetrics(metrics: {
    fraudDetections?: number;
    qualityScore?: number;
    errorCount?: number;
    processingTime?: number;
  }): Promise<void> {
    try {
      const metricData = [];

      if (metrics.fraudDetections !== undefined) {
        metricData.push({
          MetricName: 'FraudDetections',
          Value: metrics.fraudDetections,
          Unit: 'Count',
        });
      }

      if (metrics.qualityScore !== undefined) {
        metricData.push({
          MetricName: 'SubmissionQualityScore',
          Value: metrics.qualityScore,
          Unit: 'None',
        });
      }

      if (metrics.errorCount !== undefined) {
        metricData.push({
          MetricName: 'ErrorCount',
          Value: metrics.errorCount,
          Unit: 'Count',
        });
      }

      if (metrics.processingTime !== undefined) {
        metricData.push({
          MetricName: 'TaskProcessingTime',
          Value: metrics.processingTime,
          Unit: 'Seconds',
        });
      }

      if (metricData.length > 0) {
        await cloudwatch
          .putMetricData({
            Namespace: this.NAMESPACE,
            MetricData: metricData,
          })
          .promise();
      }
    } catch (error) {
      logger.error('Error publishing metrics:', error);
      throw error;
    }
  }
}
