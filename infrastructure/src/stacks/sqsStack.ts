import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { createTaskQueues, TaskQueueSet } from '../../sqs/queues';

interface SQSStackProps extends cdk.StackProps {
  stage: string;
  alertEmail?: string;
  encryptionKey?: kms.Key;
}

/**
 * Stack that creates and configures all SQS queues for the Aletheia system
 */
export class SQSStack extends cdk.Stack {
  // Public properties for queues
  public readonly taskDistributionQueue: sqs.Queue;
  public readonly highPriorityTaskQueue: sqs.Queue;
  public readonly verificationSubmissionQueue: sqs.Queue;
  public readonly workerNotificationQueue: sqs.Queue;
  public readonly taskExpirationQueue: sqs.Queue;
  public readonly resultsProcessingQueue: sqs.Queue;
  public readonly queueEncryptionKey: kms.Key;
  
  // Reference to all queues
  private readonly allQueues: TaskQueueSet;
  
  // Alert topic for queue monitoring
  private readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SQSStackProps) {
    super(scope, id, props);
    
    // Create alert topic for monitoring
    this.alertTopic = new sns.Topic(this, 'QueueAlertTopic', {
      displayName: `Aletheia-${props.stage}-Queue-Alerts`,
      topicName: `aletheia-${props.stage}-queue-alerts`,
    });
    
    // Add email subscription if provided
    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alertEmail)
      );
    }
    
    // Create all queues
    this.allQueues = createTaskQueues(this, props.stage, props.encryptionKey);
    
    // Assign public properties
    this.taskDistributionQueue = this.allQueues.taskDistributionQueue;
    this.highPriorityTaskQueue = this.allQueues.highPriorityTaskQueue;
    this.verificationSubmissionQueue = this.allQueues.verificationSubmissionQueue;
    this.workerNotificationQueue = this.allQueues.workerNotificationQueue;
    this.taskExpirationQueue = this.allQueues.taskExpirationQueue;
    this.resultsProcessingQueue = this.allQueues.resultsProcessingQueue;
    this.queueEncryptionKey = this.allQueues.queueEncryptionKey;
    
    // Create queue processor Lambda functions
    this.createQueueProcessors(props.stage);
    
    // Set up CloudWatch alarms for queue monitoring
    this.setupQueueMonitoring();
    
    // Create stack outputs
    this.createStackOutputs();
  }
  
  /**
   * Creates Lambda functions to process messages from the queues
   */
  private createQueueProcessors(stage: string): void {
    // Task Distribution Queue Processor
    const taskDistributionProcessor = new lambda.Function(this, 'TaskDistributionProcessor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'taskDistributionProcessor.handler',
      code: lambda.Code.fromAsset('src/handlers/sqs'),
      environment: {
        QUEUE_URL: this.taskDistributionQueue.queueUrl,
        TASKS_TABLE: `aletheia-${stage}-tasks`,
        WORKERS_TABLE: `aletheia-${stage}-workers`,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        STAGE: stage,
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
    });
    
    // Grant permissions
    this.taskDistributionQueue.grantConsumeMessages(taskDistributionProcessor);
    this.highPriorityTaskQueue.grantConsumeMessages(taskDistributionProcessor);
    
    // Add event source for task distribution queue
    taskDistributionProcessor.addEventSource(
      new lambda_event_sources.SqsEventSource(this.taskDistributionQueue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(30),
        reportBatchItemFailures: true, // Allows partial batch failures
      })
    );
    
    // Add event source for high-priority task distribution queue
    taskDistributionProcessor.addEventSource(
      new lambda_event_sources.SqsEventSource(this.highPriorityTaskQueue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(10), // Faster processing for high-priority
        reportBatchItemFailures: true,
      })
    );
    
    // Verification Submission Queue Processor
    const verificationSubmissionProcessor = new lambda.Function(this, 'VerificationSubmissionProcessor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'verificationSubmissionProcessor.handler',
      code: lambda.Code.fromAsset('src/handlers/sqs'),
      environment: {
        QUEUE_URL: this.verificationSubmissionQueue.queueUrl,
        TASKS_TABLE: `aletheia-${stage}-tasks`,
        WORKERS_TABLE: `aletheia-${stage}-workers`,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        STAGE: stage,
      },
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
    });
    
    // Grant permissions
    this.verificationSubmissionQueue.grantConsumeMessages(verificationSubmissionProcessor);
    
    // Add event source for verification submission queue
    verificationSubmissionProcessor.addEventSource(
      new lambda_event_sources.SqsEventSource(this.verificationSubmissionQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(30),
        reportBatchItemFailures: true,
      })
    );
    
    // Grant permissions for DynamoDB tables
    const dynamoDbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
        'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/aletheia-${stage}-tasks`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/aletheia-${stage}-workers`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/aletheia-${stage}-tasks/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/aletheia-${stage}-workers/index/*`,
      ],
    });
    
    taskDistributionProcessor.addToRolePolicy(dynamoDbPolicy);
    verificationSubmissionProcessor.addToRolePolicy(dynamoDbPolicy);
    
    // Grant SNS permissions
    this.alertTopic.grantPublish(taskDistributionProcessor);
    this.alertTopic.grantPublish(verificationSubmissionProcessor);
  }
  
  /**
   * Sets up CloudWatch alarms for monitoring queue health
   */
  private setupQueueMonitoring(): void {
    // DLQ alarms to monitor failed messages
    this.createDLQAlarm(this.allQueues.taskDistributionDLQ, 'TaskDistributionDLQ');
    this.createDLQAlarm(this.allQueues.verificationSubmissionDLQ, 'VerificationSubmissionDLQ');
    this.createDLQAlarm(this.allQueues.workerNotificationDLQ, 'WorkerNotificationDLQ');
    this.createDLQAlarm(this.allQueues.taskExpirationDLQ, 'TaskExpirationDLQ');
    this.createDLQAlarm(this.allQueues.resultsProcessingDLQ, 'ResultsProcessingDLQ');
    
    // Age of oldest message alarms
    this.createAgeAlarm(this.taskDistributionQueue, 'TaskDistributionQueue', 5); // 5 minutes
    this.createAgeAlarm(this.highPriorityTaskQueue, 'HighPriorityTaskQueue', 2); // 2 minutes
    this.createAgeAlarm(this.verificationSubmissionQueue, 'VerificationSubmissionQueue', 10); // 10 minutes
  }
  
  /**
   * Creates a CloudWatch alarm for messages in a DLQ
   */
  private createDLQAlarm(queue: sqs.Queue, queueName: string): void {
    // Alarm for any messages appearing in the DLQ
    const alarm = new cloudwatch.Alarm(this, `${queueName}MessagesAlarm`, {
      alarmDescription: `Messages detected in ${queueName}`,
      metric: queue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    
    // Send alarm to SNS topic
    alarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
  }
  
  /**
   * Creates a CloudWatch alarm for the age of the oldest message in a queue
   */
  private createAgeAlarm(queue: sqs.Queue, queueName: string, thresholdMinutes: number): void {
    // Alarm for age of oldest message
    const alarm = new cloudwatch.Alarm(this, `${queueName}AgeAlarm`, {
      alarmDescription: `Oldest message in ${queueName} is older than ${thresholdMinutes} minutes`,
      metric: queue.metricApproximateAgeOfOldestMessage({
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: thresholdMinutes * 60, // Convert to seconds
      evaluationPeriods: 3, // Must breach for 3 consecutive periods
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    
    // Send alarm to SNS topic
    alarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
  }
  
  /**
   * Creates CloudFormation outputs for the stack
   */
  private createStackOutputs(): void {
    // Queue URLs
    new cdk.CfnOutput(this, 'TaskDistributionQueueUrl', {
      value: this.taskDistributionQueue.queueUrl,
      description: 'URL of the task distribution queue',
      exportName: `aletheia-taskdistribution-queue-url`,
    });
    
    new cdk.CfnOutput(this, 'HighPriorityQueueUrl', {
      value: this.highPriorityTaskQueue.queueUrl,
      description: 'URL of the high priority task queue',
      exportName: `aletheia-highpriority-queue-url`,
    });
    
    new cdk.CfnOutput(this, 'VerificationSubmissionQueueUrl', {
      value: this.verificationSubmissionQueue.queueUrl,
      description: 'URL of the verification submission queue',
      exportName: `aletheia-verification-queue-url`,
    });
    
    // ARNs
    new cdk.CfnOutput(this, 'TaskDistributionQueueArn', {
      value: this.taskDistributionQueue.queueArn,
      description: 'ARN of the task distribution queue',
    });
    
    new cdk.CfnOutput(this, 'VerificationSubmissionQueueArn', {
      value: this.verificationSubmissionQueue.queueArn,
      description: 'ARN of the verification submission queue',
    });
  }
} 