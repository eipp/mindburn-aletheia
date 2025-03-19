import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export function createPerformanceDashboard(stack: cdk.Stack): cloudwatch.Dashboard {
  const dashboard = new cloudwatch.Dashboard(stack, 'PerformanceDashboard', {
    dashboardName: 'MindBurnAletheia-Performance',
  });

  // API Gateway Metrics
  const apiMetrics = new cloudwatch.GraphWidget({
    title: 'API Gateway Performance',
    left: [
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        statistic: 'p95',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        statistic: 'sum',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        statistic: 'sum',
      }),
    ],
    right: [
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: 'sum',
      }),
    ],
  });

  // Lambda Performance
  const lambdaMetrics = new cloudwatch.GraphWidget({
    title: 'Lambda Performance',
    left: [
      new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Duration',
        statistic: 'p95',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        statistic: 'sum',
      }),
    ],
    right: [
      new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        statistic: 'max',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Throttles',
        statistic: 'sum',
      }),
    ],
  });

  // DynamoDB Performance
  const dynamoMetrics = new cloudwatch.GraphWidget({
    title: 'DynamoDB Performance',
    left: [
      new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'SuccessfulRequestLatency',
        statistic: 'p95',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        statistic: 'sum',
      }),
    ],
    right: [
      new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        statistic: 'sum',
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        statistic: 'sum',
      }),
    ],
  });

  // Custom Business Metrics
  const businessMetrics = new cloudwatch.GraphWidget({
    title: 'Business Metrics',
    left: [
      new cloudwatch.Metric({
        namespace: 'MindBurnAletheia',
        metricName: 'VerificationProcessingTime',
        statistic: 'p95',
      }),
      new cloudwatch.Metric({
        namespace: 'MindBurnAletheia',
        metricName: 'VerificationAccuracy',
        statistic: 'average',
      }),
    ],
    right: [
      new cloudwatch.Metric({
        namespace: 'MindBurnAletheia',
        metricName: 'TasksProcessed',
        statistic: 'sum',
      }),
      new cloudwatch.Metric({
        namespace: 'MindBurnAletheia',
        metricName: 'WorkerUtilization',
        statistic: 'average',
      }),
    ],
  });

  // Cost Metrics
  const costMetrics = new cloudwatch.GraphWidget({
    title: 'Cost Metrics',
    left: [
      new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        statistic: 'maximum',
      }),
    ],
  });

  dashboard.addWidgets(apiMetrics, lambdaMetrics, dynamoMetrics, businessMetrics, costMetrics);

  return dashboard;
}
