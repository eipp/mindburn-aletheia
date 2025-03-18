import { ScalingManager } from './ScalingManager';
import { PerformanceBenchmark } from './PerformanceBenchmark';
import { ScalingConfig } from '../config/ScalingConfig';
import { Logger } from '../utils/Logger';

export class DeploymentManager {
  private readonly scalingManager: ScalingManager;
  private readonly benchmark: PerformanceBenchmark;
  private readonly config: ScalingConfig;
  private readonly logger: Logger;

  constructor() {
    this.scalingManager = new ScalingManager();
    this.benchmark = new PerformanceBenchmark();
    this.config = ScalingConfig.getInstance();
    this.logger = new Logger();
  }

  async deployRegionalInfrastructure(region: string): Promise<void> {
    try {
      this.logger.info('Starting regional deployment', { region });

      // Deploy Lambda functions with scaling config
      await this.scalingManager.configureLambdaScaling('verification-engine');
      await this.scalingManager.configureLambdaScaling('fraud-detector');
      await this.scalingManager.configureLambdaScaling('quality-control');

      // Configure DynamoDB tables
      await this.scalingManager.configureDynamoDBScaling('worker_activity');
      await this.scalingManager.configureDynamoDBScaling('fraud_events');

      // Configure API Gateway
      await this.scalingManager.configureApiGatewayScaling('mindburn-api', 'production');

      // Run initial performance benchmark
      const benchmarkResults = await this.benchmark.runBenchmark(region, 300);
      const analysis = await this.benchmark.analyzeBenchmarkResults([benchmarkResults]);

      // Apply optimizations based on benchmark results
      await this.applyOptimizations(region, analysis);

      this.logger.info('Regional deployment completed', { 
        region,
        benchmarkResults,
        analysis
      });
    } catch (error) {
      this.logger.error('Regional deployment failed', { error, region });
      throw error;
    }
  }

  async deployGlobalInfrastructure(): Promise<void> {
    try {
      this.logger.info('Starting global deployment');

      // Configure CloudFront distribution
      await this.scalingManager.configureCloudFrontDistribution('mindburn-distribution');

      // Deploy to all configured regions
      const regions = this.config.getLambdaConfig().regions;
      await Promise.all(regions.map(region => this.deployRegionalInfrastructure(region)));

      this.logger.info('Global deployment completed', { regions });
    } catch (error) {
      this.logger.error('Global deployment failed', { error });
      throw error;
    }
  }

  private async applyOptimizations(region: string, analysis: any): Promise<void> {
    for (const recommendation of analysis.recommendations) {
      try {
        switch (recommendation) {
          case 'Consider using provisioned concurrency or Lambda SnapStart':
            await this.scalingManager.configureLambdaScaling('verification-engine');
            break;
          case 'Consider implementing DAX or adjusting read capacity':
            await this.scalingManager.configureDynamoDBScaling('worker_activity');
            break;
          case 'Enable API caching and optimize Lambda execution':
            await this.scalingManager.configureApiGatewayScaling('mindburn-api', 'production');
            break;
          case 'Review cache settings and TTL configurations':
            await this.scalingManager.configureCloudFrontDistribution('mindburn-distribution');
            break;
        }
        this.logger.info('Applied optimization', { region, recommendation });
      } catch (error) {
        this.logger.error('Failed to apply optimization', { error, region, recommendation });
      }
    }
  }

  async rollback(region: string): Promise<void> {
    try {
      this.logger.info('Starting rollback', { region });
      // Implement rollback logic here
      this.logger.info('Rollback completed', { region });
    } catch (error) {
      this.logger.error('Rollback failed', { error, region });
      throw error;
    }
  }
} 