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
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: EnvironmentConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS key for encryption
    const encryptionKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: `Encryption key for ${config.environment} environment`,
      alias: `aletheia/${config.environment}/encryption-key`,
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aletheia-${config.environment}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('WebClient', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${config.domainName}/auth/callback`],
        logoutUrls: [`https://${config.domainName}/auth/logout`],
      },
    });

    // DynamoDB Tables
    const taskTable = new dynamodb.Table(this, 'TaskTable', {
      tableName: `aletheia-${config.environment}-tasks`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userDataTable = new dynamodb.Table(this, 'UserDataTable', {
      tableName: `aletheia-${config.environment}-user-data`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Buckets
    const storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `aletheia-${config.environment}-storage`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(storageBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [config.domainName],
      certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        config.certificateArn
      ),
    });

    // SQS Queues
    const taskQueue = new sqs.Queue(this, 'TaskQueue', {
      queueName: `aletheia-${config.environment}-tasks`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(14),
    });

    // SNS Topics
    const notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `aletheia-${config.environment}-notifications`,
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
        USER_POOL_ID: userPool.userPoolId,
        STORAGE_BUCKET: storageBucket.bucketName,
        ENVIRONMENT: config.environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    taskTable.grantReadWriteData(apiHandler);
    userDataTable.grantReadWriteData(apiHandler);
    taskQueue.grantSendMessages(apiHandler);
    notificationTopic.grantPublish(apiHandler);
    storageBucket.grantReadWrite(apiHandler);

    // REST API Gateway
    const restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `aletheia-${config.environment}-api`,
      description: 'Aletheia REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
      deployOptions: {
        stageName: config.environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // WebSocket API Gateway
    const websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `aletheia-${config.environment}-websocket`,
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
      stageName: config.environment,
      autoDeploy: true,
    });

    // CloudWatch Alarms
    new cdk.aws_cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: restApi.metricServerError(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'API Server Error Rate > 0',
    });

    // Output values
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'RestApiUrl', { value: restApi.url });
    new cdk.CfnOutput(this, 'WebSocketApiUrl', { value: websocketApi.apiEndpoint });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
  }
} 