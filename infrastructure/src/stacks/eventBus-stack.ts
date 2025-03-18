import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface EventBusStackProps extends cdk.StackProps {
  alertEmail?: string;
  environment: string;
}

export class EventBusStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly processedEventsTable: dynamodb.Table;
  private readonly alertTopic: sns.Topic;
  private readonly environment: string;

  constructor(scope: Construct, id: string, props: EventBusStackProps) {
    super(scope, id, props);

    this.environment = props.environment;

    // Create SNS topic for alerts
    this.alertTopic = new sns.Topic(this, 'EventAlertsTopic', {
      topicName: `${this.environment}-event-alerts`,
    });

    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alertEmail)
      );
    }

    // Create custom event bus
    this.eventBus = new events.EventBus(this, 'AletheiaEventBus', {
      eventBusName: `${this.environment}-aletheia-events`,
    });

    // Enable CloudTrail for event bus
    this.eventBus.archive('EventBusArchive', {
      archiveName: `${this.environment}-events-archive`,
      description: 'Archive for all Aletheia events',
      retention: cdk.Duration.days(90),
    });

    // Create DLQ for failed events
    this.deadLetterQueue = new sqs.Queue(this, 'EventsDLQ', {
      queueName: `${this.environment}-events-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'EventsDLQBackup', {
          queueName: `${this.environment}-events-dlq-backup`,
          retentionPeriod: cdk.Duration.days(14),
          encryption: sqs.QueueEncryption.KMS_MANAGED,
          enforceSSL: true,
        }),
      },
    });

    // Create DynamoDB table for processed events
    this.processedEventsTable = new dynamodb.Table(this, 'ProcessedEvents', {
      tableName: `${this.environment}-processed-events`,
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for correlation ID
    this.processedEventsTable.addGlobalSecondaryIndex({
      indexName: 'correlationId-index',
      partitionKey: { name: 'correlationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create event rules and targets
    this.createTaskEventRules();
    this.createVerificationEventRules();
    this.createPaymentEventRules();
    this.createUserEventRules();

    // Create CloudWatch alarms
    this.createEventAlarms();
  }

  private createTaskEventRules() {
    const rules = [
      {
        name: 'task-created',
        pattern: { detailType: ['task.created'] },
        handler: 'TaskCreatedHandler',
      },
      {
        name: 'task-assigned',
        pattern: { detailType: ['task.assigned'] },
        handler: 'TaskAssignedHandler',
      },
    ];

    rules.forEach(rule => this.createEventRule(rule));
  }

  private createVerificationEventRules() {
    const rules = [
      {
        name: 'verification-submitted',
        pattern: { detailType: ['verification.submitted'] },
        handler: 'VerificationSubmittedHandler',
      },
    ];

    rules.forEach(rule => this.createEventRule(rule));
  }

  private createPaymentEventRules() {
    const rules = [
      {
        name: 'payment-processed',
        pattern: { detailType: ['payment.processed'] },
        handler: 'PaymentProcessedHandler',
      },
    ];

    rules.forEach(rule => this.createEventRule(rule));
  }

  private createUserEventRules() {
    const rules = [
      {
        name: 'user-registered',
        pattern: { detailType: ['user.registered'] },
        handler: 'UserRegisteredHandler',
      },
    ];

    rules.forEach(rule => this.createEventRule(rule));
  }

  private createEventRule(ruleConfig: { name: string; pattern: any; handler: string }) {
    const rule = new events.Rule(this, `${ruleConfig.name}Rule`, {
      eventBus: this.eventBus,
      ruleName: `${this.environment}-${ruleConfig.name}`,
      description: `Rule for ${ruleConfig.name} events`,
      eventPattern: ruleConfig.pattern,
    });

    this.addLambdaTarget(rule, ruleConfig.handler);
  }

  private addLambdaTarget(rule: events.Rule, handlerName: string) {
    const handler = new lambda.Function(this, handlerName, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`../src/handlers/${handlerName}`),
      memorySize: 1792,
      timeout: cdk.Duration.seconds(30),
      deadLetterQueue: this.deadLetterQueue,
      deadLetterQueueEnabled: true,
      retryAttempts: 2,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        PROCESSED_EVENTS_TABLE: this.processedEventsTable.tableName,
        ENVIRONMENT: this.environment,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
      },
      logRetention: cdk.aws_logs.RetentionDays.TWO_WEEKS,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
    });

    // Add required permissions
    handler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:Query',
        'events:PutEvents',
        'sns:Publish',
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
      ],
      resources: [
        this.processedEventsTable.tableArn,
        `${this.processedEventsTable.tableArn}/index/*`,
        this.eventBus.eventBusArn,
        this.alertTopic.topicArn,
      ],
    }));

    rule.addTarget(new targets.LambdaFunction(handler, {
      deadLetterQueue: this.deadLetterQueue,
      maxEventAge: cdk.Duration.hours(24),
      retryAttempts: 3,
    }));

    return handler;
  }

  private createEventAlarms() {
    // DLQ Message Count Alarm
    new cloudwatch.Alarm(this, 'DLQMessageCountAlarm', {
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Events in DLQ detected',
      actionsEnabled: true,
      alarmName: `${this.environment}-events-dlq-alarm`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Event Processing Errors Alarm
    new cloudwatch.Alarm(this, 'EventProcessingErrorsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Events',
        metricName: 'FailedInvocations',
        dimensionsMap: {
          EventBusName: this.eventBus.eventBusName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'High number of failed event processing attempts',
      actionsEnabled: true,
      alarmName: `${this.environment}-event-processing-errors`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Lambda Error Rate Alarm
    new cloudwatch.Alarm(this, 'LambdaErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: this.eventBus.eventBusName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'High Lambda error rate detected',
      actionsEnabled: true,
      alarmName: `${this.environment}-lambda-error-rate`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }
} 