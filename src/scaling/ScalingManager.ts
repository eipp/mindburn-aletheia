import { 
  AutoScalingClient,
  PutScalingPolicyCommand,
  RegisterScalableTargetCommand
} from '@aws-sdk/client-application-auto-scaling';
import {
  DynamoDBClient,
  UpdateTableCommand,
  CreateGlobalTableCommand
} from '@aws-sdk/client-dynamodb';
import {
  LambdaClient,
  PutProvisionedConcurrencyConfigCommand,
  UpdateFunctionConfigurationCommand
} from '@aws-sdk/client-lambda';
import {
  ApiGatewayV2Client,
  UpdateStageCommand
} from '@aws-sdk/client-apigatewayv2';
import {
  CloudFrontClient,
  UpdateDistributionCommand
} from '@aws-sdk/client-cloudfront';
import { ScalingConfig } from '../config/ScalingConfig';
import { Logger } from '../utils/Logger';
import { MetricsPublisher } from '../verification/MetricsPublisher';

export class ScalingManager {
  private readonly autoScaling: AutoScalingClient;
  private readonly dynamodb: DynamoDBClient;
  private readonly lambda: LambdaClient;
  private readonly apiGateway: ApiGatewayV2Client;
  private readonly cloudFront: CloudFrontClient;
  private readonly config: ScalingConfig;
  private readonly logger: Logger;
  private readonly metrics: MetricsPublisher;

  constructor() {
    this.autoScaling = new AutoScalingClient({});
    this.dynamodb = new DynamoDBClient({});
    this.lambda = new LambdaClient({});
    this.apiGateway = new ApiGatewayV2Client({});
    this.cloudFront = new CloudFrontClient({});
    this.config = ScalingConfig.getInstance();
    this.logger = new Logger();
    this.metrics = new MetricsPublisher();
  }

  async configureLambdaScaling(functionName: string): Promise<void> {
    const lambdaConfig = this.config.getLambdaConfig();

    try {
      // Update function configuration
      await this.lambda.send(new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        MemorySize: lambdaConfig.memorySize,
        Timeout: lambdaConfig.timeout
      }));

      // Configure provisioned concurrency
      if (lambdaConfig.provisionedConcurrency > 0) {
        await this.lambda.send(new PutProvisionedConcurrencyConfigCommand({
          FunctionName: functionName,
          Qualifier: 'LATEST',
          ProvisionedConcurrentExecutions: lambdaConfig.provisionedConcurrency
        }));
      }

      this.logger.info('Lambda scaling configured', { functionName });
    } catch (error) {
      this.logger.error('Failed to configure Lambda scaling', { error, functionName });
      throw error;
    }
  }

  async configureDynamoDBScaling(tableName: string): Promise<void> {
    const dynamoConfig = this.config.getDynamoDBConfig();
    const tableConfig = dynamoConfig.tables[tableName];

    try {
      // Update table capacity
      await this.dynamodb.send(new UpdateTableCommand({
        TableName: tableName,
        ProvisionedThroughput: {
          ReadCapacityUnits: tableConfig.readCapacityUnits,
          WriteCapacityUnits: tableConfig.writeCapacityUnits
        }
      }));

      // Configure auto-scaling
      await this.configureTableAutoScaling(tableName, tableConfig);

      // Configure global tables if enabled
      if (tableConfig.globalTables.length > 0) {
        await this.dynamodb.send(new CreateGlobalTableCommand({
          GlobalTableName: tableName,
          ReplicationGroup: tableConfig.globalTables.map(region => ({ RegionName: region }))
        }));
      }

      this.logger.info('DynamoDB scaling configured', { tableName });
    } catch (error) {
      this.logger.error('Failed to configure DynamoDB scaling', { error, tableName });
      throw error;
    }
  }

  private async configureTableAutoScaling(tableName: string, tableConfig: any): Promise<void> {
    const dimensions = [
      { Name: 'dynamodb:table:ReadCapacityUnits', Value: tableName },
      { Name: 'dynamodb:table:WriteCapacityUnits', Value: tableName }
    ];

    for (const dimension of dimensions) {
      // Register scalable target
      await this.autoScaling.send(new RegisterScalableTargetCommand({
        ServiceNamespace: 'dynamodb',
        ResourceId: `table/${tableName}`,
        ScalableDimension: dimension.Name,
        MinCapacity: tableConfig.autoscaling.minCapacity,
        MaxCapacity: tableConfig.autoscaling.maxCapacity
      }));

      // Configure scaling policy
      await this.autoScaling.send(new PutScalingPolicyCommand({
        ServiceNamespace: 'dynamodb',
        ResourceId: `table/${tableName}`,
        ScalableDimension: dimension.Name,
        PolicyName: `${tableName}-${dimension.Value}-scaling-policy`,
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: tableConfig.autoscaling.targetUtilization,
          PredefinedMetricSpecification: {
            PredefinedMetricType: `DynamoDB${dimension.Name.split(':')[2]}`
          }
        }
      }));
    }
  }

  async configureApiGatewayScaling(apiId: string, stageName: string): Promise<void> {
    const apiConfig = this.config.getApiGatewayConfig();
    const stageConfig = apiConfig.stages[stageName];

    try {
      await this.apiGateway.send(new UpdateStageCommand({
        ApiId: apiId,
        StageName: stageName,
        StageConfig: {
          CacheConfig: {
            Enabled: stageConfig.caching.enabled,
            Ttl: stageConfig.caching.ttl,
            Size: stageConfig.caching.size,
            DataEncrypted: stageConfig.caching.dataEncrypted
          },
          ThrottlingConfig: {
            RateLimit: stageConfig.throttling.rateLimit,
            BurstLimit: stageConfig.throttling.burstLimit
          },
          CompressionEnabled: stageConfig.compression,
          MinimumCompressionSize: stageConfig.minimumCompressionSize
        }
      }));

      this.logger.info('API Gateway scaling configured', { apiId, stageName });
    } catch (error) {
      this.logger.error('Failed to configure API Gateway scaling', { error, apiId, stageName });
      throw error;
    }
  }

  async configureCloudFrontDistribution(distributionId: string): Promise<void> {
    const cloudFrontConfig = this.config.getCloudFrontConfig();
    const distributionConfig = cloudFrontConfig.distributions.miniApp;

    try {
      await this.cloudFront.send(new UpdateDistributionCommand({
        Id: distributionId,
        DistributionConfig: {
          PriceClass: distributionConfig.priceClass,
          Origins: {
            Items: distributionConfig.origins.map(origin => ({
              DomainName: origin.domainName,
              CustomOriginConfig: {
                HTTPPort: 80,
                HTTPSPort: 443,
                OriginProtocolPolicy: 'https-only'
              }
            }))
          },
          CacheBehaviors: {
            Items: distributionConfig.cacheBehaviors.map(behavior => ({
              PathPattern: behavior.pathPattern,
              TargetOriginId: 'primary',
              ViewerProtocolPolicy: 'redirect-to-https',
              AllowedMethods: behavior.allowedMethods,
              CachedMethods: behavior.cachedMethods,
              Compress: behavior.compress,
              DefaultTTL: behavior.ttl
            }))
          }
        }
      }));

      this.logger.info('CloudFront distribution configured', { distributionId });
    } catch (error) {
      this.logger.error('Failed to configure CloudFront distribution', { error, distributionId });
      throw error;
    }
  }

  async monitorScalingMetrics(): Promise<void> {
    try {
      const metrics = {
        lambda: {
          concurrentExecutions: 0,
          coldStarts: 0,
          provisionedUtilization: 0
        },
        dynamodb: {
          readUtilization: 0,
          writeUtilization: 0,
          throttledRequests: 0
        },
        apiGateway: {
          requestCount: 0,
          latency: 0,
          cacheHitRate: 0
        },
        cloudFront: {
          requestCount: 0,
          cacheHitRate: 0,
          originLatency: 0
        }
      };

      await this.metrics.publishMetrics(metrics);
      this.logger.info('Scaling metrics published');
    } catch (error) {
      this.logger.error('Failed to publish scaling metrics', { error });
      throw error;
    }
  }
} 