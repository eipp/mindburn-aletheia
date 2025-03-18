import { DeploymentManager } from '../src/scaling/DeploymentManager';
import { CostOptimizationManager } from '../src/scaling/CostOptimizationManager';
import { PerformanceBenchmark } from '../src/scaling/PerformanceBenchmark';
import { ScalingDashboard } from '../src/scaling/ScalingDashboard';
import { Logger } from '../src/utils/Logger';
import { CloudWatchClient, PutMetricAlarmCommand } from '@aws-sdk/client-cloudwatch';

async function createScalingAlerts(region: string) {
  const cloudWatch = new CloudWatchClient({ region });
  const logger = new Logger();

  try {
    // Lambda concurrency alert
    await cloudWatch.send(new PutMetricAlarmCommand({
      AlarmName: `${region}-lambda-concurrency-alert`,
      MetricName: 'ConcurrentExecutions',
      Namespace: 'AWS/Lambda',
      Period: 300,
      EvaluationPeriods: 2,
      Threshold: 800,
      ComparisonOperator: 'GreaterThanThreshold',
      Statistic: 'Maximum',
      ActionsEnabled: true,
      AlarmActions: ['YOUR_SNS_TOPIC_ARN'],
      AlarmDescription: 'Alert when Lambda concurrency exceeds 80% of limit'
    }));

    // DynamoDB throttling alert
    await cloudWatch.send(new PutMetricAlarmCommand({
      AlarmName: `${region}-dynamodb-throttling-alert`,
      MetricName: 'ThrottledRequests',
      Namespace: 'AWS/DynamoDB',
      Period: 300,
      EvaluationPeriods: 2,
      Threshold: 100,
      ComparisonOperator: 'GreaterThanThreshold',
      Statistic: 'Sum',
      ActionsEnabled: true,
      AlarmActions: ['YOUR_SNS_TOPIC_ARN'],
      AlarmDescription: 'Alert when DynamoDB throttling exceeds threshold'
    }));

    // API Gateway latency alert
    await cloudWatch.send(new PutMetricAlarmCommand({
      AlarmName: `${region}-apigateway-latency-alert`,
      MetricName: 'Latency',
      Namespace: 'AWS/ApiGateway',
      Period: 300,
      EvaluationPeriods: 2,
      Threshold: 1000,
      ComparisonOperator: 'GreaterThanThreshold',
      Statistic: 'p99',
      ActionsEnabled: true,
      AlarmActions: ['YOUR_SNS_TOPIC_ARN'],
      AlarmDescription: 'Alert when API Gateway p99 latency exceeds 1s'
    }));

    logger.info('Scaling alerts created', { region });
  } catch (error) {
    logger.error('Failed to create scaling alerts', { error, region });
    throw error;
  }
}

async function deployScalingInfrastructure() {
  const deploymentManager = new DeploymentManager();
  const costManager = new CostOptimizationManager();
  const benchmark = new PerformanceBenchmark();
  const dashboard = new ScalingDashboard();
  const logger = new Logger();

  try {
    logger.info('Starting scaling infrastructure deployment');

    // Deploy global infrastructure
    await deploymentManager.deployGlobalInfrastructure();

    // Wait for infrastructure to stabilize
    await new Promise(resolve => setTimeout(resolve, 300000));

    // Run benchmarks in each region
    const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
    const benchmarkResults = await Promise.all(
      regions.map(region => benchmark.runBenchmark(region, 300))
    );

    // Create CloudWatch dashboard
    await dashboard.createDashboard(regions);

    // Create scaling alerts in each region
    await Promise.all(regions.map(region => createScalingAlerts(region)));

    // Analyze performance and costs
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 1);
    
    for (const region of regions) {
      // Get resource utilization
      const utilization = await costManager.analyzeResourceUtilization(
        region,
        startTime,
        new Date()
      );

      // Generate cost report
      const costReport = await costManager.generateCostReport(region, utilization);

      // Apply optimizations if needed
      if (costReport.projectedSavings > 1000) {
        await costManager.optimizeResources(region, utilization);
        
        // Update dashboard after optimization
        await dashboard.updateDashboard(regions);
      }

      logger.info('Region deployment completed', {
        region,
        costReport,
        benchmarkResults: benchmarkResults.find(r => r.region === region)
      });
    }

    logger.info('Scaling infrastructure deployment completed');
  } catch (error) {
    logger.error('Deployment failed', { error });
    process.exit(1);
  }
}

// Run deployment
deployScalingInfrastructure().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 