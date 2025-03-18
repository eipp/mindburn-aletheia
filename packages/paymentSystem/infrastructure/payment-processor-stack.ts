import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { PaymentBatchesTable } from './payment-batches-table';

export class PaymentProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the payment batches table
    const paymentBatchesTable = new PaymentBatchesTable(this, 'PaymentBatchesTable');

    // Create the Lambda function
    const processBatchesFunction = new lambda.Function(this, 'ProcessPaymentBatches', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/process-payment-batches.handler',
      code: lambda.Code.fromAsset('../dist'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        PAYMENT_BATCHES_TABLE: paymentBatchesTable.table.tableName,
        TON_NETWORK: process.env.TON_NETWORK || 'testnet',
        TON_ENDPOINT: process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC',
        TON_API_KEY: process.env.TON_API_KEY!,
        KMS_KEY_ID: process.env.KMS_KEY_ID!,
        WALLET_ADDRESS: process.env.WALLET_ADDRESS!
      },
      tracing: lambda.Tracing.ACTIVE
    });

    // Grant DynamoDB permissions
    paymentBatchesTable.table.grantReadWriteData(processBatchesFunction);

    // Grant KMS permissions
    const kmsKey = iam.Key.fromKeyArn(this, 'KMSKey', process.env.KMS_KEY_ARN!);
    kmsKey.grantDecrypt(processBatchesFunction);

    // Create EventBridge rule to trigger the function every 5 minutes
    new events.Rule(this, 'ProcessPaymentBatchesRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(processBatchesFunction)]
    });

    // Add CloudWatch alarms
    const failedBatchesAlarm = new cdk.aws_cloudwatch.Alarm(this, 'FailedBatchesAlarm', {
      metric: processBatchesFunction.metricErrors(),
      threshold: 3,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when payment batch processing has failures',
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    // Add tags
    cdk.Tags.of(this).add('Service', 'PaymentSystem');
    cdk.Tags.of(this).add('Environment', process.env.ENVIRONMENT || 'development');
  }
} 