import { CloudWatch, DynamoDB, SNS } from 'aws-sdk';
import { ScheduledEvent } from 'aws-lambda';
import { VerificationStrategy } from '../verification/types';

interface StrategyInsights {
  strategy: VerificationStrategy;
  successRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  totalTasks: number;
}

interface WorkerInsights {
  workerId: string;
  accuracyScore: number;
  averageProcessingTime: number;
  taskCount: number;
  riskScore: number;
  recommendations: string[];
}

interface SystemInsights {
  totalTasks: number;
  averageQueueSize: number;
  peakQueueSize: number;
  errorRate: number;
  activeWorkers: number;
  recommendations: string[];
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const cloudwatch = new CloudWatch();
  const dynamodb = new DynamoDB.DocumentClient();
  const sns = new SNS();

  try {
    // Get metrics for the last 24 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    // Analyze strategy performance
    const strategyInsights = await analyzeStrategyPerformance(cloudwatch, startTime, endTime);

    // Analyze worker performance
    const workerInsights = await analyzeWorkerPerformance(cloudwatch, dynamodb, startTime, endTime);

    // Analyze system health
    const systemInsights = await analyzeSystemHealth(cloudwatch, startTime, endTime);

    // Generate recommendations
    const recommendations = generateRecommendations(
      strategyInsights,
      workerInsights,
      systemInsights
    );

    // Save insights to DynamoDB
    await saveInsights(dynamodb, {
      timestamp: endTime.toISOString(),
      strategyInsights,
      workerInsights,
      systemInsights,
      recommendations,
    });

    // Send notification if there are critical insights
    if (hasCriticalInsights(systemInsights, workerInsights)) {
      await notifyStakeholders(sns, recommendations);
    }
  } catch (error) {
    console.error('Error analyzing metrics:', error);
    throw error;
  }
};

async function analyzeStrategyPerformance(
  cloudwatch: CloudWatch,
  startTime: Date,
  endTime: Date
): Promise<StrategyInsights[]> {
  const strategies = Object.values(VerificationStrategy);
  const insights: StrategyInsights[] = [];

  for (const strategy of strategies) {
    const metrics = await cloudwatch
      .getMetricData({
        MetricDataQueries: [
          {
            Id: 'successRate',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'SuccessRate',
                Dimensions: [{ Name: 'Strategy', Value: strategy }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'confidence',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'Confidence',
                Dimensions: [{ Name: 'Strategy', Value: strategy }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'processingTime',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'ProcessingTime',
                Dimensions: [{ Name: 'Strategy', Value: strategy }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
      })
      .promise();

    insights.push({
      strategy,
      successRate: calculateAverage(metrics.MetricDataResults[0].Values),
      averageConfidence: calculateAverage(metrics.MetricDataResults[1].Values),
      averageProcessingTime: calculateAverage(metrics.MetricDataResults[2].Values),
      totalTasks: metrics.MetricDataResults[0].Values.length,
    });
  }

  return insights;
}

async function analyzeWorkerPerformance(
  cloudwatch: CloudWatch,
  dynamodb: DynamoDB.DocumentClient,
  startTime: Date,
  endTime: Date
): Promise<WorkerInsights[]> {
  // Get all active workers
  const workers = await dynamodb
    .scan({
      TableName: process.env.WORKERS_TABLE!,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'ACTIVE' },
    })
    .promise();

  const insights: WorkerInsights[] = [];

  for (const worker of workers.Items || []) {
    const metrics = await cloudwatch
      .getMetricData({
        MetricDataQueries: [
          {
            Id: 'accuracyScore',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'AccuracyScore',
                Dimensions: [{ Name: 'WorkerId', Value: worker.workerId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'processingTime',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'ProcessingTime',
                Dimensions: [{ Name: 'WorkerId', Value: worker.workerId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'riskScore',
            MetricStat: {
              Metric: {
                Namespace: 'Verification/Metrics',
                MetricName: 'RiskScore',
                Dimensions: [{ Name: 'WorkerId', Value: worker.workerId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
      })
      .promise();

    const accuracyScore = calculateAverage(metrics.MetricDataResults[0].Values);
    const processingTime = calculateAverage(metrics.MetricDataResults[1].Values);
    const riskScore = calculateAverage(metrics.MetricDataResults[2].Values);

    insights.push({
      workerId: worker.workerId,
      accuracyScore,
      averageProcessingTime: processingTime,
      taskCount: metrics.MetricDataResults[0].Values.length,
      riskScore,
      recommendations: generateWorkerRecommendations(accuracyScore, processingTime, riskScore),
    });
  }

  return insights;
}

async function analyzeSystemHealth(
  cloudwatch: CloudWatch,
  startTime: Date,
  endTime: Date
): Promise<SystemInsights> {
  const metrics = await cloudwatch
    .getMetricData({
      MetricDataQueries: [
        {
          Id: 'queueSize',
          MetricStat: {
            Metric: {
              Namespace: 'Verification/Metrics',
              MetricName: 'QueueSize',
            },
            Period: 3600,
            Stat: 'Average',
          },
        },
        {
          Id: 'peakQueueSize',
          MetricStat: {
            Metric: {
              Namespace: 'Verification/Metrics',
              MetricName: 'QueueSize',
            },
            Period: 3600,
            Stat: 'Maximum',
          },
        },
        {
          Id: 'errorRate',
          MetricStat: {
            Metric: {
              Namespace: 'Verification/Metrics',
              MetricName: 'ErrorRate',
            },
            Period: 3600,
            Stat: 'Average',
          },
        },
        {
          Id: 'activeWorkers',
          MetricStat: {
            Metric: {
              Namespace: 'Verification/Metrics',
              MetricName: 'ActiveWorkers',
            },
            Period: 3600,
            Stat: 'Average',
          },
        },
      ],
      StartTime: startTime,
      EndTime: endTime,
    })
    .promise();

  const averageQueueSize = calculateAverage(metrics.MetricDataResults[0].Values);
  const peakQueueSize = Math.max(...metrics.MetricDataResults[1].Values);
  const errorRate = calculateAverage(metrics.MetricDataResults[2].Values);
  const activeWorkers = calculateAverage(metrics.MetricDataResults[3].Values);

  return {
    totalTasks: metrics.MetricDataResults[0].Values.length,
    averageQueueSize,
    peakQueueSize,
    errorRate,
    activeWorkers,
    recommendations: generateSystemRecommendations(averageQueueSize, errorRate, activeWorkers),
  };
}

function generateWorkerRecommendations(
  accuracyScore: number,
  processingTime: number,
  riskScore: number
): string[] {
  const recommendations: string[] = [];

  if (accuracyScore < 0.8) {
    recommendations.push('Consider additional training to improve accuracy');
  }
  if (processingTime > 300000) {
    // 5 minutes
    recommendations.push('Review task processing workflow to improve efficiency');
  }
  if (riskScore > 0.7) {
    recommendations.push('Investigate potential fraudulent activity');
  }

  return recommendations;
}

function generateSystemRecommendations(
  averageQueueSize: number,
  errorRate: number,
  activeWorkers: number
): string[] {
  const recommendations: string[] = [];

  if (averageQueueSize > 100) {
    recommendations.push('Consider scaling up worker pool to handle increased load');
  }
  if (errorRate > 0.05) {
    recommendations.push('Investigate high error rate - may need system optimization');
  }
  if (activeWorkers < 10) {
    recommendations.push('Worker pool may be insufficient for current load');
  }

  return recommendations;
}

function generateRecommendations(
  strategyInsights: StrategyInsights[],
  workerInsights: WorkerInsights[],
  systemInsights: SystemInsights
): string[] {
  const recommendations: string[] = [];

  // Strategy recommendations
  const lowPerformingStrategies = strategyInsights.filter(s => s.successRate < 0.8);
  if (lowPerformingStrategies.length > 0) {
    recommendations.push(
      `Review configuration of strategies: ${lowPerformingStrategies.map(s => s.strategy).join(', ')}`
    );
  }

  // Worker recommendations
  const lowPerformingWorkers = workerInsights.filter(w => w.accuracyScore < 0.7);
  if (lowPerformingWorkers.length > 0) {
    recommendations.push('Consider retraining or reassigning low-performing workers');
  }

  // System recommendations
  recommendations.push(...systemInsights.recommendations);

  return recommendations;
}

async function saveInsights(dynamodb: DynamoDB.DocumentClient, insights: any): Promise<void> {
  await dynamodb
    .put({
      TableName: process.env.INSIGHTS_TABLE!,
      Item: insights,
    })
    .promise();
}

function hasCriticalInsights(
  systemInsights: SystemInsights,
  workerInsights: WorkerInsights[]
): boolean {
  return (
    systemInsights.errorRate > 0.1 ||
    systemInsights.averageQueueSize > 200 ||
    workerInsights.some(w => w.riskScore > 0.8)
  );
}

async function notifyStakeholders(sns: SNS, recommendations: string[]): Promise<void> {
  await sns
    .publish({
      TopicArn: process.env.ALERTS_TOPIC_ARN,
      Subject: 'Critical Verification System Insights',
      Message: `
Critical insights detected in the verification system:

${recommendations.join('\n')}

Please review the metrics dashboard for more details.
    `.trim(),
    })
    .promise();
}

function calculateAverage(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
