import { CloudWatch } from 'aws-sdk';
import { MetricType, TaskStatus, TaskType } from '../types';

const cloudwatch = new CloudWatch();
const NAMESPACE = 'MindBurn/TaskManagement';

export async function publishTaskMetric(
  taskType: TaskType,
  status: TaskStatus,
  duration?: number
): Promise<void> {
  const metrics = [
    {
      MetricName: 'TaskCount',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'TaskType', Value: taskType },
        { Name: 'Status', Value: status },
      ],
    },
  ];

  if (duration) {
    metrics.push({
      MetricName: 'TaskDuration',
      Value: duration,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'TaskType', Value: taskType }],
    });
  }

  await cloudwatch
    .putMetricData({
      Namespace: NAMESPACE,
      MetricData: metrics,
    })
    .promise();
}

export async function publishWorkerMetric(
  metricType: MetricType,
  value: number,
  taskType?: TaskType
): Promise<void> {
  const dimensions = [{ Name: 'MetricType', Value: metricType }];

  if (taskType) {
    dimensions.push({ Name: 'TaskType', Value: taskType });
  }

  await cloudwatch
    .putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: 'WorkerMetric',
          Value: value,
          Unit: metricType.includes('RATE') ? 'Percent' : 'None',
          Dimensions: dimensions,
        },
      ],
    })
    .promise();
}

export async function publishQueueMetrics(
  queueName: string,
  messageCount: number,
  processedCount: number,
  failedCount: number
): Promise<void> {
  const metrics = [
    {
      MetricName: 'QueueMessageCount',
      Value: messageCount,
      Unit: 'Count',
      Dimensions: [{ Name: 'QueueName', Value: queueName }],
    },
    {
      MetricName: 'ProcessedMessageCount',
      Value: processedCount,
      Unit: 'Count',
      Dimensions: [{ Name: 'QueueName', Value: queueName }],
    },
    {
      MetricName: 'FailedMessageCount',
      Value: failedCount,
      Unit: 'Count',
      Dimensions: [{ Name: 'QueueName', Value: queueName }],
    },
  ];

  await cloudwatch
    .putMetricData({
      Namespace: NAMESPACE,
      MetricData: metrics,
    })
    .promise();
}

export async function publishLatencyMetric(operationType: string, latency: number): Promise<void> {
  await cloudwatch
    .putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: 'OperationLatency',
          Value: latency,
          Unit: 'Milliseconds',
          Dimensions: [{ Name: 'OperationType', Value: operationType }],
        },
      ],
    })
    .promise();
}

export async function publishErrorMetric(errorCode: string, count: number = 1): Promise<void> {
  await cloudwatch
    .putMetricData({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: 'ErrorCount',
          Value: count,
          Unit: 'Count',
          Dimensions: [{ Name: 'ErrorCode', Value: errorCode }],
        },
      ],
    })
    .promise();
}

// Utility function to measure operation duration
export function measureDuration(startTime: number): number {
  return Date.now() - startTime;
}

// Wrapper for measuring operation latency
export function withLatencyMetric(operationType: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = measureDuration(startTime);
        await publishLatencyMetric(operationType, duration);
        return result;
      } catch (error) {
        const duration = measureDuration(startTime);
        await publishLatencyMetric(operationType, duration);
        throw error;
      }
    };

    return descriptor;
  };
}
