import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

// Import the table creation functions
import { 
  createTasksTable,
  createWorkersTable,
  createCompaniesTable,
  createVerificationsTable,
  createTransactionsTable,
  createPaymentBatchesTable
} from '../../dynamodb/tables';

// Import queue creation functions
import { createTaskQueues, TaskQueueSet } from '../../sqs/queues';

// Import EventBridge rule creation functions
import {
  createTaskCreatedRule,
  createTaskCompletedRule,
  createVerificationSubmittedRule,
  createPaymentProcessingRule
} from '../../eventbridge/rules';

interface InfrastructureStackProps extends cdk.StackProps {
  stage: string;
  alertEmail?: string;
}

/**
 * Stack that creates all infrastructure resources for the Aletheia platform
 */
export class InfrastructureStack extends cdk.Stack {
  // Public properties for accessing from other stacks
  public readonly taskTable: dynamodb.Table;
  public readonly workerTable: dynamodb.Table;
  public readonly companyTable: dynamodb.Table;
  public readonly verificationTable: dynamodb.Table;
  public readonly transactionTable: dynamodb.Table;
  public readonly paymentBatchTable: dynamodb.Table;
  
  public readonly eventBus: events.EventBus;
  public readonly queues: TaskQueueSet;
  
  public readonly encryptionKey: kms.Key;
  public readonly alertTopic: sns.Topic;
  
  // Expose all DynamoDB tables for replication
  public readonly dynamoTables: dynamodb.Table[];

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    // Create encryption key for securing sensitive data
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: `Encryption key for Aletheia ${stage} environment`,
      alias: `aletheia/${stage}/encryption-key`,
    });

    // Create alert topic for notifications
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `aletheia-${stage}-alerts`,
      masterKey: this.encryptionKey,
    });

    // Add email subscription if email is provided
    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alertEmail)
      );
    }

    // Create DynamoDB tables
    this.taskTable = createTasksTable(this, 'TasksTable');
    this.workerTable = createWorkersTable(this, 'WorkersTable');
    this.companyTable = createCompaniesTable(this);
    this.verificationTable = createVerificationsTable(this);
    this.transactionTable = createTransactionsTable(this);
    this.paymentBatchTable = createPaymentBatchesTable(this);
    
    // Populate dynamoTables array for replication
    this.dynamoTables = [
      this.taskTable,
      this.workerTable,
      this.companyTable,
      this.verificationTable,
      this.transactionTable,
      this.paymentBatchTable
    ];

    // Create SQS queues
    this.queues = createTaskQueues(this, stage, this.encryptionKey);

    // Create custom EventBridge event bus
    this.eventBus = new events.EventBus(this, 'AletheiaEventBus', {
      eventBusName: `aletheia-${stage}-events`
    });

    // Enable archive for the event bus
    this.eventBus.archive('EventArchive', {
      archiveName: `aletheia-${stage}-events-archive`,
      description: 'Archive for all Aletheia events',
      retention: cdk.Duration.days(90),
      eventPattern: {
        source: ['com.mindburn.aletheia']
      }
    });

    // Create Lambda functions for event processing
    const taskDistributionFunction = this.createTaskDistributionFunction(stage);
    const resultProcessingFunction = this.createResultProcessingFunction(stage);
    const notificationFunction = this.createNotificationFunction(stage);
    const verificationProcessingFunction = this.createVerificationProcessingFunction(stage);

    // Create EventBridge rules
    createTaskCreatedRule(this, this.eventBus, taskDistributionFunction);
    createTaskCompletedRule(this, this.eventBus, notificationFunction, resultProcessingFunction);
    createVerificationSubmittedRule(this, this.eventBus, verificationProcessingFunction);
    createPaymentProcessingRule(this, this.eventBus, new targets.SqsQueue(this.queues.paymentQueue));

    // Create CloudFormation outputs
    this.createOutputs(stage);
  }

  /**
   * Creates the Lambda function for task distribution
   */
  private createTaskDistributionFunction(stage: string): lambda.Function {
    const fn = new lambda.Function(this, 'TaskDistributionFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/handlers/taskDistribution'),
      environment: {
        STAGE: stage,
        TASKS_TABLE: this.taskTable.tableName,
        WORKERS_TABLE: this.workerTable.tableName,
        TASK_QUEUE_URL: this.queues.taskDistributionQueue.queueUrl,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 1024,
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant permissions
    this.taskTable.grantReadWriteData(fn);
    this.workerTable.grantReadWriteData(fn);
    this.queues.taskDistributionQueue.grantSendMessages(fn);
    this.eventBus.grantPutEventsTo(fn);

    return fn;
  }

  /**
   * Creates the Lambda function for result processing
   */
  private createResultProcessingFunction(stage: string): lambda.Function {
    const fn = new lambda.Function(this, 'ResultProcessingFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/handlers/resultProcessing'),
      environment: {
        STAGE: stage,
        TASKS_TABLE: this.taskTable.tableName,
        WORKERS_TABLE: this.workerTable.tableName,
        VERIFICATIONS_TABLE: this.verificationTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 1024,
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant permissions
    this.taskTable.grantReadWriteData(fn);
    this.workerTable.grantReadWriteData(fn);
    this.verificationTable.grantReadWriteData(fn);
    this.eventBus.grantPutEventsTo(fn);

    return fn;
  }

  /**
   * Creates the Lambda function for notification handling
   */
  private createNotificationFunction(stage: string): lambda.Function {
    const fn = new lambda.Function(this, 'NotificationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/handlers/notification'),
      environment: {
        STAGE: stage,
        WORKERS_TABLE: this.workerTable.tableName,
        COMPANIES_TABLE: this.companyTable.tableName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant permissions
    this.workerTable.grantReadData(fn);
    this.companyTable.grantReadData(fn);
    this.alertTopic.grantPublish(fn);

    return fn;
  }

  /**
   * Creates the Lambda function for verification processing
   */
  private createVerificationProcessingFunction(stage: string): lambda.Function {
    const fn = new lambda.Function(this, 'VerificationProcessingFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/handlers/verificationProcessing'),
      environment: {
        STAGE: stage,
        TASKS_TABLE: this.taskTable.tableName,
        WORKERS_TABLE: this.workerTable.tableName,
        VERIFICATIONS_TABLE: this.verificationTable.tableName,
        TRANSACTIONS_TABLE: this.transactionTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        PAYMENT_QUEUE_URL: this.queues.paymentQueue.queueUrl,
      },
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant permissions
    this.taskTable.grantReadWriteData(fn);
    this.workerTable.grantReadWriteData(fn);
    this.verificationTable.grantReadWriteData(fn);
    this.transactionTable.grantWriteData(fn);
    this.queues.paymentQueue.grantSendMessages(fn);
    this.eventBus.grantPutEventsTo(fn);

    return fn;
  }

  /**
   * Creates CloudFormation outputs for the stack
   */
  private createOutputs(stage: string): void {
    // Table names
    new cdk.CfnOutput(this, 'TasksTableName', {
      value: this.taskTable.tableName,
      description: 'Name of the Tasks table',
      exportName: `${stage}-tasks-table`
    });

    new cdk.CfnOutput(this, 'WorkersTableName', {
      value: this.workerTable.tableName,
      description: 'Name of the Workers table',
      exportName: `${stage}-workers-table`
    });

    new cdk.CfnOutput(this, 'CompaniesTableName', {
      value: this.companyTable.tableName,
      description: 'Name of the Companies table',
      exportName: `${stage}-companies-table`
    });

    new cdk.CfnOutput(this, 'VerificationsTableName', {
      value: this.verificationTable.tableName,
      description: 'Name of the Verifications table',
      exportName: `${stage}-verifications-table`
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: this.transactionTable.tableName,
      description: 'Name of the Transactions table',
      exportName: `${stage}-transactions-table`
    });

    new cdk.CfnOutput(this, 'PaymentBatchesTableName', {
      value: this.paymentBatchTable.tableName,
      description: 'Name of the PaymentBatches table',
      exportName: `${stage}-payment-batches-table`
    });

    // Queue URLs
    new cdk.CfnOutput(this, 'TaskQueueUrl', {
      value: this.queues.taskDistributionQueue.queueUrl,
      description: 'URL of the Task distribution queue',
      exportName: `${stage}-task-queue-url`
    });

    new cdk.CfnOutput(this, 'VerificationQueueUrl', {
      value: this.queues.verificationSubmissionQueue.queueUrl,
      description: 'URL of the Verification submission queue',
      exportName: `${stage}-verification-queue-url`
    });

    new cdk.CfnOutput(this, 'PaymentQueueUrl', {
      value: this.queues.paymentQueue.queueUrl,
      description: 'URL of the Payment queue',
      exportName: `${stage}-payment-queue-url`
    });

    // Event bus name
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'Name of the Aletheia event bus',
      exportName: `${stage}-event-bus-name`
    });

    // Replication outputs
    new cdk.CfnOutput(this, 'DynamoTablesForReplication', {
      value: this.dynamoTables.map(table => table.tableName).join(','),
      description: 'Comma-separated list of DynamoDB tables for replication',
      exportName: `${stage}-dynamodb-tables-for-replication`
    });
    
    new cdk.CfnOutput(this, 'PrimaryRegion', {
      value: this.region,
      description: 'Primary region for the infrastructure',
      exportName: `${stage}-primary-region`
    });
    
    // Get backup region from context or environment
    const envName = this.node.tryGetContext('env') || 'dev';
    const backupRegion = this.node.tryGetContext('backup-region') || 'us-west-2';
    
    new cdk.CfnOutput(this, 'BackupRegion', {
      value: backupRegion,
      description: 'Backup region for multi-region resilience',
      exportName: `${stage}-backup-region`
    });
    
    new cdk.CfnOutput(this, 'MultiRegionEnabled', {
      value: this.node.tryGetContext('enable-multi-region') || 'false',
      description: 'Whether multi-region replication is enabled',
      exportName: `${stage}-multi-region-enabled`
    });
  }
} 