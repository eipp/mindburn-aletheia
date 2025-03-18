import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';
import { ScalingConfig } from '../config/ScalingConfig';
import { Logger } from '../utils/Logger';

export class ScalingDashboard {
  private readonly cloudWatch: CloudWatchClient;
  private readonly config: ScalingConfig;
  private readonly logger: Logger;

  constructor() {
    this.cloudWatch = new CloudWatchClient({});
    this.config = ScalingConfig.getInstance();
    this.logger = new Logger();
  }

  async createDashboard(regions: string[]): Promise<void> {
    try {
      const widgets = [
        ...this.createLambdaWidgets(regions),
        ...this.createDynamoDBWidgets(regions),
        ...this.createApiGatewayWidgets(regions),
        ...this.createCloudFrontWidgets()
      ];

      await this.cloudWatch.send(new PutDashboardCommand({
        DashboardName: 'MindBurn-Scaling-Metrics',
        DashboardBody: JSON.stringify({
          widgets,
          periodOverride: 'auto'
        })
      }));

      this.logger.info('Scaling dashboard created');
    } catch (error) {
      this.logger.error('Failed to create scaling dashboard', { error });
      throw error;
    }
  }

  private createLambdaWidgets(regions: string[]): any[] {
    return [
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: regions.flatMap(region => [
            ['AWS/Lambda', 'ConcurrentExecutions', 'FunctionName', 'verification-engine', 'Region', region],
            ['AWS/Lambda', 'ConcurrentExecutions', 'FunctionName', 'fraud-detector', 'Region', region],
            ['AWS/Lambda', 'ConcurrentExecutions', 'FunctionName', 'quality-control', 'Region', region]
          ]),
          region: regions[0],
          title: 'Lambda Concurrent Executions by Region'
        }
      },
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: regions.flatMap(region => [
            ['AWS/Lambda', 'Duration', 'FunctionName', 'verification-engine', 'Region', region],
            ['AWS/Lambda', 'Duration', 'FunctionName', 'fraud-detector', 'Region', region],
            ['AWS/Lambda', 'Duration', 'FunctionName', 'quality-control', 'Region', region]
          ]),
          region: regions[0],
          title: 'Lambda Duration by Function and Region'
        }
      }
    ];
  }

  private createDynamoDBWidgets(regions: string[]): any[] {
    return [
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: regions.flatMap(region => [
            ['AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', 'worker_activity', 'Region', region],
            ['AWS/DynamoDB', 'ConsumedWriteCapacityUnits', 'TableName', 'worker_activity', 'Region', region],
            ['AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', 'fraud_events', 'Region', region],
            ['AWS/DynamoDB', 'ConsumedWriteCapacityUnits', 'TableName', 'fraud_events', 'Region', region]
          ]),
          region: regions[0],
          title: 'DynamoDB Capacity Units by Region'
        }
      },
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: regions.flatMap(region => [
            ['AWS/DAX', 'CPUUtilization', 'ClusterID', 'worker-activity-dax', 'Region', region],
            ['AWS/DAX', 'CacheHitRate', 'ClusterID', 'worker-activity-dax', 'Region', region]
          ]),
          region: regions[0],
          title: 'DAX Performance by Region'
        }
      }
    ];
  }

  private createApiGatewayWidgets(regions: string[]): any[] {
    return [
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: regions.flatMap(region => [
            ['AWS/ApiGateway', 'Count', 'ApiId', 'mindburn-api', 'Stage', 'production', 'Region', region],
            ['AWS/ApiGateway', 'Latency', 'ApiId', 'mindburn-api', 'Stage', 'production', 'Region', region],
            ['AWS/ApiGateway', 'CacheHitCount', 'ApiId', 'mindburn-api', 'Stage', 'production', 'Region', region],
            ['AWS/ApiGateway', 'CacheMissCount', 'ApiId', 'mindburn-api', 'Stage', 'production', 'Region', region]
          ]),
          region: regions[0],
          title: 'API Gateway Performance by Region'
        }
      }
    ];
  }

  private createCloudFrontWidgets(): any[] {
    return [
      {
        type: 'metric',
        width: 12,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            ['AWS/CloudFront', 'Requests', 'DistributionId', 'mindburn-distribution'],
            ['AWS/CloudFront', 'TotalErrorRate', 'DistributionId', 'mindburn-distribution'],
            ['AWS/CloudFront', 'BytesDownloaded', 'DistributionId', 'mindburn-distribution'],
            ['AWS/CloudFront', 'BytesUploaded', 'DistributionId', 'mindburn-distribution']
          ],
          region: 'us-east-1',
          title: 'CloudFront Performance'
        }
      }
    ];
  }

  async updateDashboard(regions: string[]): Promise<void> {
    try {
      await this.createDashboard(regions);
      this.logger.info('Scaling dashboard updated');
    } catch (error) {
      this.logger.error('Failed to update scaling dashboard', { error });
      throw error;
    }
  }
} 