import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  userPool: cognito.IUserPool;
  stage: string;
  workerLambda: lambda.IFunction;
  developerLambda: lambda.IFunction;
  taskManagementLambda: lambda.IFunction;
  verificationLambda: lambda.IFunction;
  paymentLambda: lambda.IFunction;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly websocketApi: apigateway.WebSocketApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Create WAF ACL
    const wafAcl = new wafv2.CfnWebACL(this, 'ApiWafAcl', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'ApiWafMetrics',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'RateLimit',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitMetric',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Create REST API
    this.restApi = new apigateway.RestApi(this, 'MindBurnApi', {
      restApiName: `mindburn-api-${props.stage}`,
      description: 'Mindburn Aletheia API Gateway',
      deployOptions: {
        stageName: props.stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        throttlingBurstLimit: 1000,
        throttlingRateLimit: 2000,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [props.userPool],
    });

    // API Resources and Methods
    const api = this.restApi.root;

    // Worker API
    const workers = api.addResource('workers');
    this.addLambdaIntegration(workers, props.workerLambda, authorizer);

    // Developer API
    const developers = api.addResource('developers');
    this.addLambdaIntegration(developers, props.developerLambda, authorizer);

    // Task Management API
    const tasks = api.addResource('tasks');
    this.addLambdaIntegration(tasks, props.taskManagementLambda, authorizer);

    // Verification API
    const verifications = api.addResource('verifications');
    this.addLambdaIntegration(verifications, props.verificationLambda, authorizer);

    // Payment API
    const payments = api.addResource('payments');
    this.addLambdaIntegration(payments, props.paymentLambda, authorizer);

    // Create WebSocket API
    this.websocketApi = new apigateway.WebSocketApi(this, 'MindBurnWebSocketApi', {
      apiName: `mindburn-websocket-${props.stage}`,
      connectRouteOptions: { integration: new apigateway.WebSocketLambdaIntegration('ConnectIntegration', props.workerLambda) },
      disconnectRouteOptions: { integration: new apigateway.WebSocketLambdaIntegration('DisconnectIntegration', props.workerLambda) },
      defaultRouteOptions: { integration: new apigateway.WebSocketLambdaIntegration('DefaultIntegration', props.workerLambda) },
    });

    // WebSocket Stage
    const websocketStage = new apigateway.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: props.stage,
      autoDeploy: true,
    });

    // Associate WAF with APIs
    new wafv2.CfnWebACLAssociation(this, 'RestApiWafAssociation', {
      resourceArn: this.restApi.deploymentStage.stageArn,
      webAclArn: wafAcl.attrArn,
    });

    // Add CloudWatch logging
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Output API endpoints
    new cdk.CfnOutput(this, 'RestApiEndpoint', {
      value: this.restApi.url,
      description: 'REST API Endpoint',
    });

    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: this.websocketApi.apiEndpoint,
      description: 'WebSocket API Endpoint',
    });
  }

  private addLambdaIntegration(
    resource: apigateway.IResource,
    lambda: lambda.IFunction,
    authorizer: apigateway.CognitoUserPoolsAuthorizer,
  ) {
    const integration = new apigateway.LambdaIntegration(lambda, {
      proxy: true,
      timeout: cdk.Duration.seconds(29),
    });

    resource.addMethod('GET', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    resource.addMethod('POST', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    resource.addMethod('PUT', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    resource.addMethod('DELETE', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
  }
} 