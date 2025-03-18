import { CloudWatch } from 'aws-sdk';
import { VerificationStrategy } from './types';

interface VerificationMetrics {
  strategy: VerificationStrategy;
  processingTime: number;
  confidence: number;
  decision: 'APPROVED' | 'REJECTED';
  contributors: any[];
}

interface WorkerMetrics {
  workerId: string;
  expertiseLevel: string;
  accuracyScore: number;
  processingTime: number;
  taskType: string;
}

interface FraudMetrics {
  workerId: string;
  riskScore: number;
  suspiciousFactors: string[];
}

export class MetricsPublisher {
  private cloudwatch: CloudWatch;
  private readonly namespace = 'Verification/Metrics';

  constructor() {
    this.cloudwatch = new CloudWatch();
  }

  async publishVerificationMetrics(metrics: VerificationMetrics): Promise<void> {
    const timestamp = new Date();
    const dimensions = [
      { Name: 'Strategy', Value: metrics.strategy },
      { Name: 'Decision', Value: metrics.decision }
    ];

    const metricData = [
      {
        MetricName: 'ProcessingTime',
        Value: metrics.processingTime,
        Unit: 'Milliseconds',
        Dimensions: dimensions
      },
      {
        MetricName: 'Confidence',
        Value: metrics.confidence,
        Unit: 'None',
        Dimensions: dimensions
      },
      {
        MetricName: 'ContributorCount',
        Value: metrics.contributors.length,
        Unit: 'Count',
        Dimensions: dimensions
      }
    ];

    await this.publishMetrics(metricData, timestamp);
  }

  async publishWorkerMetrics(metrics: WorkerMetrics): Promise<void> {
    const timestamp = new Date();
    const dimensions = [
      { Name: 'WorkerId', Value: metrics.workerId },
      { Name: 'ExpertiseLevel', Value: metrics.expertiseLevel },
      { Name: 'TaskType', Value: metrics.taskType }
    ];

    const metricData = [
      {
        MetricName: 'AccuracyScore',
        Value: metrics.accuracyScore,
        Unit: 'None',
        Dimensions: dimensions
      },
      {
        MetricName: 'ProcessingTime',
        Value: metrics.processingTime,
        Unit: 'Milliseconds',
        Dimensions: dimensions
      }
    ];

    await this.publishMetrics(metricData, timestamp);
  }

  async publishFraudMetrics(metrics: FraudMetrics): Promise<void> {
    const timestamp = new Date();
    const dimensions = [
      { Name: 'WorkerId', Value: metrics.workerId }
    ];

    const metricData = [
      {
        MetricName: 'RiskScore',
        Value: metrics.riskScore,
        Unit: 'None',
        Dimensions: dimensions
      },
      {
        MetricName: 'SuspiciousFactorsCount',
        Value: metrics.suspiciousFactors.length,
        Unit: 'Count',
        Dimensions: dimensions
      }
    ];

    await this.publishMetrics(metricData, timestamp);
  }

  async publishStrategyPerformance(
    strategy: VerificationStrategy,
    successRate: number,
    averageConfidence: number,
    averageProcessingTime: number
  ): Promise<void> {
    const timestamp = new Date();
    const dimensions = [
      { Name: 'Strategy', Value: strategy }
    ];

    const metricData = [
      {
        MetricName: 'SuccessRate',
        Value: successRate,
        Unit: 'Percent',
        Dimensions: dimensions
      },
      {
        MetricName: 'AverageConfidence',
        Value: averageConfidence,
        Unit: 'None',
        Dimensions: dimensions
      },
      {
        MetricName: 'AverageProcessingTime',
        Value: averageProcessingTime,
        Unit: 'Milliseconds',
        Dimensions: dimensions
      }
    ];

    await this.publishMetrics(metricData, timestamp);
  }

  async publishSystemHealth(
    queueSize: number,
    activeWorkers: number,
    errorRate: number
  ): Promise<void> {
    const timestamp = new Date();
    const dimensions = [
      { Name: 'Environment', Value: process.env.ENVIRONMENT || 'development' }
    ];

    const metricData = [
      {
        MetricName: 'QueueSize',
        Value: queueSize,
        Unit: 'Count',
        Dimensions: dimensions
      },
      {
        MetricName: 'ActiveWorkers',
        Value: activeWorkers,
        Unit: 'Count',
        Dimensions: dimensions
      },
      {
        MetricName: 'ErrorRate',
        Value: errorRate,
        Unit: 'Percent',
        Dimensions: dimensions
      }
    ];

    await this.publishMetrics(metricData, timestamp);
  }

  private async publishMetrics(
    metricData: CloudWatch.MetricData,
    timestamp: Date
  ): Promise<void> {
    try {
      await this.cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metricData.map(metric => ({
          ...metric,
          Timestamp: timestamp
        }))
      }).promise();
    } catch (error) {
      console.error('Error publishing metrics:', error);
      // Don't throw error for metrics publishing failure
    }
  }

  async createDashboard(): Promise<void> {
    const dashboard = {
      widgets: [
        {
          type: 'metric',
          properties: {
            metrics: [
              ['Verification/Metrics', 'ProcessingTime', 'Strategy', 'HUMAN_CONSENSUS'],
              ['Verification/Metrics', 'ProcessingTime', 'Strategy', 'EXPERT_WEIGHTED'],
              ['Verification/Metrics', 'ProcessingTime', 'Strategy', 'AI_ASSISTED'],
              ['Verification/Metrics', 'ProcessingTime', 'Strategy', 'GOLDEN_SET']
            ],
            view: 'timeSeries',
            stacked: false,
            region: process.env.AWS_REGION,
            title: 'Processing Time by Strategy'
          }
        },
        {
          type: 'metric',
          properties: {
            metrics: [
              ['Verification/Metrics', 'Confidence', 'Strategy', 'HUMAN_CONSENSUS'],
              ['Verification/Metrics', 'Confidence', 'Strategy', 'EXPERT_WEIGHTED'],
              ['Verification/Metrics', 'Confidence', 'Strategy', 'AI_ASSISTED'],
              ['Verification/Metrics', 'Confidence', 'Strategy', 'GOLDEN_SET']
            ],
            view: 'timeSeries',
            stacked: false,
            region: process.env.AWS_REGION,
            title: 'Confidence by Strategy'
          }
        },
        {
          type: 'metric',
          properties: {
            metrics: [
              ['Verification/Metrics', 'RiskScore', 'WorkerId', '*']
            ],
            view: 'timeSeries',
            stacked: false,
            region: process.env.AWS_REGION,
            title: 'Risk Scores by Worker'
          }
        },
        {
          type: 'metric',
          properties: {
            metrics: [
              ['Verification/Metrics', 'QueueSize'],
              ['Verification/Metrics', 'ActiveWorkers'],
              ['Verification/Metrics', 'ErrorRate']
            ],
            view: 'timeSeries',
            stacked: false,
            region: process.env.AWS_REGION,
            title: 'System Health'
          }
        }
      ]
    };

    try {
      await this.cloudwatch.putDashboard({
        DashboardName: 'VerificationMetrics',
        DashboardBody: JSON.stringify(dashboard)
      }).promise();
    } catch (error) {
      console.error('Error creating dashboard:', error);
    }
  }
} 