import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface TrafficRouterStackProps extends cdk.StackProps {
  environment: string;
  domainName: string;
  targetStack: string;
  version: string;
  hostedZoneId?: string;
  certificateArn: string;
}

/**
 * Traffic router stack for blue-green deployments
 * 
 * This stack is responsible for routing traffic between blue and green environments.
 * It creates the following resources:
 * - CloudFront distribution for frontend routing
 * - API Gateway for backend routing
 * - Route53 records to point to the routing layer
 * 
 * This stack is meant to be long-lived and updated only when switching traffic
 * between blue and green environments.
 */
export class TrafficRouterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TrafficRouterStackProps) {
    super(scope, id, props);

    // Certificates
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      props.certificateArn
    );

    // Query CloudFormation for target stack outputs
    const targetApiUrl = cdk.Fn.importValue(`${props.targetStack}:ApiUrl`);
    const targetFrontendUrl = cdk.Fn.importValue(`${props.targetStack}:FrontendUrl`);
    const targetWebSocketUrl = cdk.Fn.importValue(`${props.targetStack}:WebSocketUrl`);

    // CloudFront Origin for API
    const apiOrigin = new origins.HttpOrigin(
      cdk.Fn.select(2, cdk.Fn.split('/', targetApiUrl)),
      {
        originPath: cdk.Fn.join('', ['/', cdk.Fn.select(3, cdk.Fn.split('/', targetApiUrl))])
      }
    );

    // CloudFront Origin for Frontend
    const frontendOrigin = new origins.HttpOrigin(
      cdk.Fn.select(2, cdk.Fn.split('/', targetFrontendUrl))
    );

    // Create CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      domainNames: [props.domainName],
      certificate: certificate,
      enableLogging: true,
      logBucket: new cdk.aws_s3.Bucket(this, 'LogBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }),
      logFilePrefix: 'distribution-logs/',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Create API Gateway for routing API requests
    const apiGateway = new apigateway.RestApi(this, 'RouterApi', {
      restApiName: `${props.environment}-router-api`,
      description: `API Router for ${props.environment} environment`,
      deployOptions: {
        stageName: props.environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'RouterApiLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: cdk.Duration.days(1),
      },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      domainName: {
        domainName: `api.${props.domainName}`,
        certificate: certificate,
        endpointType: apigateway.EndpointType.REGIONAL,
      },
    });

    // Create a proxy integration to the target API Gateway
    const proxyResource = apiGateway.root.addProxy({
      defaultIntegration: new apigateway.HttpIntegration(targetApiUrl, {
        httpMethod: 'ANY',
        options: {
          requestParameters: {
            'integration.request.path.proxy': 'method.request.path.proxy',
          },
        },
      }),
      defaultMethodOptions: {
        requestParameters: {
          'method.request.path.proxy': true,
        },
      },
    });

    // Create DNS records if a hosted zone ID is provided
    if (props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      // DNS record for the main domain (CloudFront)
      new route53.ARecord(this, 'DomainAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });

      // DNS record for the API subdomain
      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: `api.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(new targets.ApiGateway(apiGateway)),
      });
    }

    // Add tags
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Name', `AletheiaMindburn-${props.environment}-router`);
    cdk.Tags.of(this).add('Version', props.version);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Outputs
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apiGateway.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'TargetStack', {
      value: props.targetStack,
      description: 'Current active deployment stack',
    });

    new cdk.CfnOutput(this, 'Version', {
      value: props.version,
      description: 'Current deployment version',
    });
  }
} 