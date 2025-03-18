import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class PaymentDashboard extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      processBatchesFunction: cdk.aws_lambda.Function;
      paymentBatchesTable: cdk.aws_dynamodb.Table;
    }
  ) {
    super(scope, id);

    const dashboard = new cloudwatch.Dashboard(this, 'PaymentSystemDashboard', {
      dashboardName: `${process.env.ENVIRONMENT}-payment-system`,
    });

    // Payment Processing Metrics
    const processingWidget = new cloudwatch.GraphWidget({
      title: 'Payment Processing',
      left: [
        props.processBatchesFunction.metricInvocations({
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
        props.processBatchesFunction.metricErrors({
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // Payment Success Rate
    const successRateWidget = new cloudwatch.GraphWidget({
      title: 'Payment Success Rate',
      left: [
        new cloudwatch.MathExpression({
          expression: '100 - 100 * errors / invocations',
          label: 'Success Rate (%)',
          usingMetrics: {
            errors: props.processBatchesFunction.metricErrors(),
            invocations: props.processBatchesFunction.metricInvocations(),
          },
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // Payment Volume
    const volumeWidget = new cloudwatch.GraphWidget({
      title: 'Payment Volume',
      left: [
        new cloudwatch.Metric({
          namespace: 'PaymentSystem',
          metricName: 'ProcessedPaymentsAmount',
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: 'PaymentSystem',
          metricName: 'ProcessedPaymentsCount',
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // Batch Processing Time
    const processingTimeWidget = new cloudwatch.GraphWidget({
      title: 'Batch Processing Time',
      left: [
        props.processBatchesFunction.metricDuration({
          statistic: 'avg',
          period: cdk.Duration.minutes(5),
        }),
        props.processBatchesFunction.metricDuration({
          statistic: 'p90',
          period: cdk.Duration.minutes(5),
        }),
        props.processBatchesFunction.metricDuration({
          statistic: 'p99',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // DynamoDB Metrics
    const dynamoDbWidget = new cloudwatch.GraphWidget({
      title: 'DynamoDB Performance',
      left: [
        props.paymentBatchesTable.metricConsumedReadCapacityUnits({
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
        props.paymentBatchesTable.metricConsumedWriteCapacityUnits({
          statistic: 'sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // TON Network Metrics
    const tonMetricsWidget = new cloudwatch.GraphWidget({
      title: 'TON Network Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'PaymentSystem',
          metricName: 'TONTransactionLatency',
          statistic: 'avg',
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: 'PaymentSystem',
          metricName: 'TONTransactionFees',
          statistic: 'avg',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
    });

    // Add all widgets to dashboard
    dashboard.addWidgets(
      processingWidget,
      successRateWidget,
      volumeWidget,
      processingTimeWidget,
      dynamoDbWidget,
      tonMetricsWidget
    );

    // Create alarms
    new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: new cloudwatch.MathExpression({
        expression: 'errors / invocations * 100',
        usingMetrics: {
          errors: props.processBatchesFunction.metricErrors(),
          invocations: props.processBatchesFunction.metricInvocations(),
        },
      }),
      threshold: 5,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });

    new cloudwatch.Alarm(this, 'HighProcessingTime', {
      metric: props.processBatchesFunction.metricDuration({
        statistic: 'p95',
      }),
      threshold: 30000, // 30 seconds
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });

    new cloudwatch.Alarm(this, 'HighDynamoDBThrottling', {
      metric: props.paymentBatchesTable.metricThrottledRequests(),
      threshold: 10,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true,
    });
  }
}
