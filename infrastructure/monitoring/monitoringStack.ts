import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  service: string;
  alarmEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `${props.service}-${props.environment}-alarms`,
      topicName: `${props.service}-${props.environment}-alarms`,
    });

    // Add email subscription
    alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(props.alarmEmail)
    );

    // API Latency Alarm
    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: new cloudwatch.Metric({
        namespace: `${props.service}/${props.environment}`,
        metricName: 'ApiLatency',
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Service: props.service,
          Environment: props.environment,
        },
      }),
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'API latency is above 1 second for 95th percentile',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-api-latency`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // API Error Rate Alarm
    new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: `${props.service}/${props.environment}`,
        metricName: 'ApiErrorRate',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Service: props.service,
          Environment: props.environment,
        },
      }),
      threshold: 10, // 10 errors per 5 minutes
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'API error rate is above threshold',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-api-error-rate`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // Payment Success Rate Alarm
    new cloudwatch.Alarm(this, 'PaymentSuccessRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: `${props.service}/${props.environment}`,
        metricName: 'PaymentSuccessRate',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Service: props.service,
          Environment: props.environment,
        },
      }),
      threshold: 95, // 95% success rate
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Payment success rate is below 95%',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-payment-success-rate`,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // Lambda Duration Alarm
    new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Duration',
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          FunctionName: `${props.service}-${props.environment}-*`,
        },
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Lambda function duration is above 5 seconds for 95th percentile',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-lambda-duration`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // DynamoDB Throttled Requests Alarm
    new cloudwatch.Alarm(this, 'DynamoDBThrottledRequestsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          TableName: `${props.service}-${props.environment}-*`,
        },
      }),
      threshold: 100, // 100 throttled requests per 5 minutes
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'DynamoDB throttled requests are above threshold',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-dynamodb-throttled`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

    // SQS Queue Age Alarm
    new cloudwatch.Alarm(this, 'SQSQueueAgeAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateAgeOfOldestMessage',
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          QueueName: `${props.service}-${props.environment}-*`,
        },
      }),
      threshold: 300, // 5 minutes
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'SQS queue age is above 5 minutes',
      actionsEnabled: true,
      alarmName: `${props.service}-${props.environment}-sqs-queue-age`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatch.SnsAction(alarmTopic));
  }
} 