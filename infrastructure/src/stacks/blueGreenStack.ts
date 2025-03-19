import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2_integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
import { ApiGatewayStack } from './apiGatewayStack';
import { WebSocketConnectionsStack } from './websocketConnectionsStack';

interface BlueGreenStackProps extends cdk.StackProps {
  stage: string;
  color: 'blue' | 'green';
  deploymentId: string;
  version: string;
  certificateArn: string;
  domainName: string;
  sharedResourcesStack?: string; // Name of stack with shared resources (DynamoDB, etc.)
}

/**
 * Blue-Green deployment stack
 * 
 * This stack represents either a blue or green environment in a blue-green deployment.
 * It creates all required resources for a complete environment, but uses references to
 * shared resources like databases that exist outside the blue-green lifecycle.
 */
export class BlueGreenStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BlueGreenStackProps) {
    super(scope, id, props);

    // Environment-specific naming suffix to ensure uniqueness
    const envSuffix = `${props.stage}-${props.color}-${props.deploymentId.substring(0, 8)}`;

    // Import shared resources like database tables if needed
    let taskTable: dynamodb.ITable;
    let userDataTable: dynamodb.ITable;
    let encryptionKey: kms.IKey;

    // If shared resources stack is provided, import resources from it
    if (props.sharedResourcesStack) {
      taskTable = dynamodb.Table.fromTableName(
        this,
        'ImportedTaskTable',
        cdk.Fn.importValue(`${props.sharedResourcesStack}:TaskTableName`)
      );
      
      userDataTable = dynamodb.Table.fromTableName(
        this,
        'ImportedUserDataTable',
        cdk.Fn.importValue(`${props.sharedResourcesStack}:UserDataTableName`)
      );
      
      encryptionKey = kms.Key.fromKeyArn(
        this,
        'ImportedEncryptionKey',
        cdk.Fn.importValue(`${props.sharedResourcesStack}:EncryptionKeyArn`)
      );
    } else {
      // Create new KMS key if not importing shared resources
      encryptionKey = new kms.Key(this, 'EncryptionKey', {
        enableKeyRotation: true,
        description: `Encryption key for ${props.stage} ${props.color} environment`,
        alias: `aletheia/${props.stage}/${props.color}/encryption-key`,
      });

      // Create DynamoDB tables
      taskTable = new dynamodb.Table(this, 'TaskTable', {
        tableName: `aletheia-${envSuffix}-tasks`,
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
        encryptionKey,
        pointInTimeRecovery: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For blue-green, we can destroy the table
      });

      userDataTable = new dynamodb.Table(this, 'UserDataTable', {
        tableName: `aletheia-${envSuffix}-user-data`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
        encryptionKey,
        pointInTimeRecovery: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For blue-green, we can destroy the table
      });
    }

    // S3 Buckets
    const storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `aletheia-${envSuffix}-storage`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Distribution
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      props.certificateArn
    );

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(storageBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [`${props.color}.${props.domainName}`],
      certificate,
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'LogBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }),
    });

    // SQS Queues
    const taskQueue = new sqs.Queue(this, 'TaskQueue', {
      queueName: `aletheia-${envSuffix}-tasks`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(14),
    });

    // SNS Topics
    const notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `aletheia-${envSuffix}-notifications`,
      masterKey: encryptionKey,
    });

    // Lambda Functions
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../packages/developer-platform/dist'),
      role: lambdaRole,
      environment: {
        TASK_TABLE: taskTable.tableName,
        USER_TABLE: userDataTable.tableName,
        TASK_QUEUE_URL: taskQueue.queueUrl,
        NOTIFICATION_TOPIC_ARN: notificationTopic.topicArn,
        STORAGE_BUCKET: storageBucket.bucketName,
        ENVIRONMENT: props.stage,
        COLOR: props.color,
        VERSION: props.version,
        DEPLOYMENT_ID: props.deploymentId,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions
    taskTable.grantReadWriteData(apiHandler);
    userDataTable.grantReadWriteData(apiHandler);
    taskQueue.grantSendMessages(apiHandler);
    notificationTopic.grantPublish(apiHandler);
    storageBucket.grantReadWrite(apiHandler);

    // REST API Gateway
    const restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `aletheia-${envSuffix}-api`,
      description: `Aletheia REST API (${props.color})`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
      deployOptions: {
        stageName: props.stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // WebSocket API Gateway
    const websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `aletheia-${envSuffix}-websocket`,
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          apiHandler
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          apiHandler
        ),
      },
    });

    new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: websocketApi,
      stageName: props.stage,
      autoDeploy: true,
    });

    // CloudWatch Alarms
    new cdk.aws_cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: restApi.metricServerError(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'API Server Error Rate > 0',
    });

    // Create WebSocket Connections table
    const websocketStack = new WebSocketConnectionsStack(this, 'WebSocketConnections', {
      stackName: `mindburn-websocket-${envSuffix}`,
    });

    // Create API Gateway stack
    const apiGatewayStack = new ApiGatewayStack(this, 'ApiGateway', {
      stackName: `mindburn-api-${envSuffix}`,
      stage: props.stage,
      workerLambda: apiHandler,
      developerLambda: apiHandler,
      taskManagementLambda: apiHandler,
      verificationLambda: apiHandler,
      paymentLambda: apiHandler,
    });

    // Grant permissions
    websocketStack.table.grantReadWriteData(apiHandler);

    // Add dependencies
    apiGatewayStack.addDependency(websocketStack);

    // Add tags
    cdk.Tags.of(this).add('Environment', props.stage);
    cdk.Tags.of(this).add('Color', props.color);
    cdk.Tags.of(this).add('Version', props.version);
    cdk.Tags.of(this).add('DeploymentId', props.deploymentId);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Output values with exportable names for cross-stack references
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: restApi.url,
      description: 'REST API URL',
      exportName: `${this.stackName}:ApiUrl`,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: websocketApi.apiEndpoint,
      description: 'WebSocket API URL',
      exportName: `${this.stackName}:WebSocketUrl`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution URL',
      exportName: `${this.stackName}:FrontendUrl`,
    });

    new cdk.CfnOutput(this, 'Version', {
      value: props.version,
      description: 'Deployment version',
      exportName: `${this.stackName}:Version`,
    });

    new cdk.CfnOutput(this, 'DeploymentId', {
      value: props.deploymentId,
      description: 'Deployment ID',
      exportName: `${this.stackName}:DeploymentId`,
    });
  }
} 