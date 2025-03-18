import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { ScalingConfig } from '../config/ScalingConfig';
import { ScalingManager } from './ScalingManager';
import { Logger } from '../utils/Logger';

interface ResourceUtilization {
  lambda: {
    concurrentExecutions: number;
    provisionedConcurrencyUtilization: number;
    coldStarts: number;
    averageMemoryUsage: number;
  };
  dynamodb: {
    readCapacityUtilization: number;
    writeCapacityUtilization: number;
    storageUtilization: number;
    daxUtilization: number;
  };
  apiGateway: {
    cacheHitRate: number;
    throttledRequests: number;
    averageLatency: number;
  };
  cloudFront: {
    cacheHitRate: number;
    dataTransfer: number;
    requests: number;
  };
}

export class CostOptimizationManager {
  private readonly cloudWatch: CloudWatchClient;
  private readonly config: ScalingConfig;
  private readonly scalingManager: ScalingManager;
  private readonly logger: Logger;

  constructor() {
    this.cloudWatch = new CloudWatchClient({});
    this.config = ScalingConfig.getInstance();
    this.scalingManager = new ScalingManager();
    this.logger = new Logger();
  }

  async analyzeResourceUtilization(region: string, startTime: Date, endTime: Date): Promise<ResourceUtilization> {
    try {
      const metricData = await this.getCloudWatchMetrics(region, startTime, endTime);
      return this.processMetricData(metricData);
    } catch (error) {
      this.logger.error('Failed to analyze resource utilization', { error, region });
      throw error;
    }
  }

  private async getCloudWatchMetrics(region: string, startTime: Date, endTime: Date): Promise<any> {
    const command = new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: [
        // Lambda metrics
        {
          Id: 'lambda_concurrent',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/Lambda',
              MetricName: 'ConcurrentExecutions'
            },
            Period: 300,
            Stat: 'Average'
          }
        },
        {
          Id: 'lambda_provisioned_util',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/Lambda',
              MetricName: 'ProvisionedConcurrencyUtilization'
            },
            Period: 300,
            Stat: 'Average'
          }
        },
        // DynamoDB metrics
        {
          Id: 'dynamodb_read_util',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/DynamoDB',
              MetricName: 'ConsumedReadCapacityUnits'
            },
            Period: 300,
            Stat: 'Sum'
          }
        },
        {
          Id: 'dynamodb_write_util',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/DynamoDB',
              MetricName: 'ConsumedWriteCapacityUnits'
            },
            Period: 300,
            Stat: 'Sum'
          }
        },
        // API Gateway metrics
        {
          Id: 'api_cache_hits',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/ApiGateway',
              MetricName: 'CacheHitCount'
            },
            Period: 300,
            Stat: 'Sum'
          }
        },
        // CloudFront metrics
        {
          Id: 'cf_requests',
          MetricStat: {
            Metric: {
              Namespace: 'AWS/CloudFront',
              MetricName: 'Requests'
            },
            Period: 300,
            Stat: 'Sum'
          }
        }
      ]
    });

    return this.cloudWatch.send(command);
  }

  private processMetricData(metricData: any): ResourceUtilization {
    return {
      lambda: {
        concurrentExecutions: this.extractMetricValue(metricData, 'lambda_concurrent'),
        provisionedConcurrencyUtilization: this.extractMetricValue(metricData, 'lambda_provisioned_util'),
        coldStarts: 0, // Calculated separately
        averageMemoryUsage: 0 // Calculated separately
      },
      dynamodb: {
        readCapacityUtilization: this.extractMetricValue(metricData, 'dynamodb_read_util'),
        writeCapacityUtilization: this.extractMetricValue(metricData, 'dynamodb_write_util'),
        storageUtilization: 0, // Calculated separately
        daxUtilization: 0 // Calculated separately
      },
      apiGateway: {
        cacheHitRate: this.extractMetricValue(metricData, 'api_cache_hits'),
        throttledRequests: 0, // Calculated separately
        averageLatency: 0 // Calculated separately
      },
      cloudFront: {
        cacheHitRate: 0, // Calculated separately
        dataTransfer: 0, // Calculated separately
        requests: this.extractMetricValue(metricData, 'cf_requests')
      }
    };
  }

  private extractMetricValue(metricData: any, metricId: string): number {
    const metric = metricData.MetricDataResults.find((m: any) => m.Id === metricId);
    return metric?.Values[0] || 0;
  }

  async optimizeResources(region: string, utilization: ResourceUtilization): Promise<void> {
    try {
      await this.optimizeLambda(region, utilization.lambda);
      await this.optimizeDynamoDB(region, utilization.dynamodb);
      await this.optimizeApiGateway(region, utilization.apiGateway);
      await this.optimizeCloudFront(utilization.cloudFront);
    } catch (error) {
      this.logger.error('Resource optimization failed', { error, region });
      throw error;
    }
  }

  private async optimizeLambda(region: string, utilization: ResourceUtilization['lambda']): Promise<void> {
    const lambdaConfig = this.config.getLambdaConfig();

    // Adjust provisioned concurrency based on utilization
    if (utilization.provisionedConcurrencyUtilization < 0.6) {
      const newConcurrency = Math.ceil(lambdaConfig.provisionedConcurrency * 0.8);
      await this.scalingManager.configureLambdaScaling('verification-engine');
    }

    // Optimize memory allocation
    if (utilization.averageMemoryUsage / lambdaConfig.memorySize < 0.5) {
      const newMemory = Math.ceil(lambdaConfig.memorySize * 0.8);
      await this.scalingManager.configureLambdaScaling('verification-engine');
    }
  }

  private async optimizeDynamoDB(region: string, utilization: ResourceUtilization['dynamodb']): Promise<void> {
    const dynamoConfig = this.config.getDynamoDBConfig();

    // Adjust read/write capacity based on utilization
    if (utilization.readCapacityUtilization < 0.6 || utilization.writeCapacityUtilization < 0.6) {
      await this.scalingManager.configureDynamoDBScaling('worker_activity');
    }

    // Optimize DAX configuration
    if (utilization.daxUtilization < 0.4) {
      // Consider reducing DAX node count or instance size
      await this.scalingManager.configureDynamoDBScaling('worker_activity');
    }
  }

  private async optimizeApiGateway(region: string, utilization: ResourceUtilization['apiGateway']): Promise<void> {
    const apiConfig = this.config.getApiGatewayConfig();

    // Adjust cache size based on hit rate
    if (utilization.cacheHitRate < 0.7) {
      await this.scalingManager.configureApiGatewayScaling('mindburn-api', 'production');
    }

    // Optimize throttling limits
    if (utilization.throttledRequests > 100) {
      await this.scalingManager.configureApiGatewayScaling('mindburn-api', 'production');
    }
  }

  private async optimizeCloudFront(utilization: ResourceUtilization['cloudFront']): Promise<void> {
    const cloudFrontConfig = this.config.getCloudFrontConfig();

    // Optimize cache behaviors based on hit rate
    if (utilization.cacheHitRate < 0.8) {
      await this.scalingManager.configureCloudFrontDistribution('mindburn-distribution');
    }

    // Adjust price class based on request distribution
    if (utilization.requests < 1000000) {
      await this.scalingManager.configureCloudFrontDistribution('mindburn-distribution');
    }
  }

  async generateCostReport(region: string, utilization: ResourceUtilization): Promise<{
    currentCosts: number;
    projectedSavings: number;
    recommendations: string[];
  }> {
    const costProjection = this.config.getCostProjection('medium');
    const recommendations: string[] = [];
    let projectedSavings = 0;

    // Analyze Lambda costs
    if (utilization.lambda.provisionedConcurrencyUtilization < 0.6) {
      const savings = costProjection.estimatedCosts.lambda * 0.2;
      projectedSavings += savings;
      recommendations.push(`Reduce provisioned concurrency to save ~$${savings}/month`);
    }

    // Analyze DynamoDB costs
    if (utilization.dynamodb.readCapacityUtilization < 0.6) {
      const savings = costProjection.estimatedCosts.dynamodb * 0.15;
      projectedSavings += savings;
      recommendations.push(`Optimize DynamoDB capacity to save ~$${savings}/month`);
    }

    // Analyze API Gateway costs
    if (utilization.apiGateway.cacheHitRate < 0.7) {
      const savings = costProjection.estimatedCosts.apiGateway * 0.1;
      projectedSavings += savings;
      recommendations.push(`Improve API Gateway caching to save ~$${savings}/month`);
    }

    return {
      currentCosts: costProjection.estimatedCosts.total,
      projectedSavings,
      recommendations
    };
  }
} 