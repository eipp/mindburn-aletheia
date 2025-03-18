import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Logger } from '../utils/Logger';
import { MetricsPublisher } from '../verification/MetricsPublisher';

interface BenchmarkResult {
  timestamp: string;
  region: string;
  metrics: {
    lambda: {
      coldStartLatency: number;
      warmStartLatency: number;
      memoryUtilization: number;
      errorRate: number;
    };
    dynamodb: {
      readLatency: number;
      writeLatency: number;
      readThroughput: number;
      writeThroughput: number;
      consistencyDelay: number;
    };
    apiGateway: {
      p50Latency: number;
      p90Latency: number;
      p99Latency: number;
      requestThroughput: number;
      errorRate: number;
    };
    cloudFront: {
      ttfb: number;
      cacheHitRatio: number;
      originLatency: number;
      errorRate: number;
    };
  };
}

export class PerformanceBenchmark {
  private readonly cloudWatch: CloudWatchClient;
  private readonly dynamodb: DynamoDBClient;
  private readonly logger: Logger;
  private readonly metrics: MetricsPublisher;

  constructor() {
    this.cloudWatch = new CloudWatchClient({});
    this.dynamodb = new DynamoDBClient({});
    this.logger = new Logger();
    this.metrics = new MetricsPublisher();
  }

  async runBenchmark(region: string, duration: number): Promise<BenchmarkResult> {
    try {
      const startTime = new Date();
      const results = await Promise.all([
        this.benchmarkLambda(duration),
        this.benchmarkDynamoDB(duration),
        this.benchmarkApiGateway(duration),
        this.benchmarkCloudFront(duration),
      ]);

      const [lambda, dynamodb, apiGateway, cloudFront] = results;

      const benchmarkResult: BenchmarkResult = {
        timestamp: startTime.toISOString(),
        region,
        metrics: {
          lambda,
          dynamodb,
          apiGateway,
          cloudFront,
        },
      };

      await this.publishBenchmarkResults(benchmarkResult);
      return benchmarkResult;
    } catch (error) {
      this.logger.error('Benchmark failed', { error, region });
      throw error;
    }
  }

  private async benchmarkLambda(duration: number): Promise<any> {
    const metrics = {
      coldStartLatency: 0,
      warmStartLatency: 0,
      memoryUtilization: 0,
      errorRate: 0,
    };

    // Simulate cold starts
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      try {
        // Invoke function with new container
        // Implementation depends on your Lambda setup
        metrics.coldStartLatency += Date.now() - start;
      } catch (error) {
        metrics.errorRate++;
      }
    }
    metrics.coldStartLatency /= 10;

    // Measure warm starts
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      try {
        // Invoke function with warm container
        metrics.warmStartLatency += Date.now() - start;
      } catch (error) {
        metrics.errorRate++;
      }
    }
    metrics.warmStartLatency /= 100;
    metrics.errorRate = (metrics.errorRate / 110) * 100;

    return metrics;
  }

  private async benchmarkDynamoDB(duration: number): Promise<any> {
    const metrics = {
      readLatency: 0,
      writeLatency: 0,
      readThroughput: 0,
      writeThroughput: 0,
      consistencyDelay: 0,
    };

    const startTime = Date.now();
    let operations = 0;

    while (Date.now() - startTime < duration * 1000) {
      try {
        const writeStart = Date.now();
        // Perform write operation
        metrics.writeLatency += Date.now() - writeStart;

        const readStart = Date.now();
        // Perform read operation
        metrics.readLatency += Date.now() - readStart;

        operations++;
      } catch (error) {
        this.logger.error('DynamoDB benchmark operation failed', { error });
      }
    }

    metrics.readLatency /= operations;
    metrics.writeLatency /= operations;
    metrics.readThroughput = operations / duration;
    metrics.writeThroughput = operations / duration;

    return metrics;
  }

  private async benchmarkApiGateway(duration: number): Promise<any> {
    const metrics = {
      p50Latency: 0,
      p90Latency: 0,
      p99Latency: 0,
      requestThroughput: 0,
      errorRate: 0,
    };

    const latencies: number[] = [];
    const startTime = Date.now();
    let requests = 0;
    let errors = 0;

    while (Date.now() - startTime < duration * 1000) {
      try {
        const requestStart = Date.now();
        // Make API request
        latencies.push(Date.now() - requestStart);
        requests++;
      } catch (error) {
        errors++;
        this.logger.error('API Gateway benchmark request failed', { error });
      }
    }

    // Calculate percentiles
    latencies.sort((a, b) => a - b);
    metrics.p50Latency = latencies[Math.floor(latencies.length * 0.5)];
    metrics.p90Latency = latencies[Math.floor(latencies.length * 0.9)];
    metrics.p99Latency = latencies[Math.floor(latencies.length * 0.99)];
    metrics.requestThroughput = requests / duration;
    metrics.errorRate = (errors / requests) * 100;

    return metrics;
  }

  private async benchmarkCloudFront(duration: number): Promise<any> {
    const metrics = {
      ttfb: 0,
      cacheHitRatio: 0,
      originLatency: 0,
      errorRate: 0,
    };

    const startTime = Date.now();
    let requests = 0;
    let cacheHits = 0;
    let errors = 0;

    while (Date.now() - startTime < duration * 1000) {
      try {
        const requestStart = Date.now();
        // Make CloudFront request
        const isCacheHit = Math.random() > 0.3; // Simulate 70% cache hit ratio
        if (isCacheHit) {
          cacheHits++;
          metrics.ttfb += Date.now() - requestStart;
        } else {
          metrics.originLatency += Date.now() - requestStart;
        }
        requests++;
      } catch (error) {
        errors++;
        this.logger.error('CloudFront benchmark request failed', { error });
      }
    }

    metrics.ttfb /= cacheHits || 1;
    metrics.originLatency /= requests - cacheHits || 1;
    metrics.cacheHitRatio = (cacheHits / requests) * 100;
    metrics.errorRate = (errors / requests) * 100;

    return metrics;
  }

  private async publishBenchmarkResults(results: BenchmarkResult): Promise<void> {
    try {
      const timestamp = new Date();
      const metrics = [];

      // Lambda metrics
      metrics.push({
        MetricName: 'LambdaColdStartLatency',
        Value: results.metrics.lambda.coldStartLatency,
        Unit: 'Milliseconds',
      });
      metrics.push({
        MetricName: 'LambdaWarmStartLatency',
        Value: results.metrics.lambda.warmStartLatency,
        Unit: 'Milliseconds',
      });

      // DynamoDB metrics
      metrics.push({
        MetricName: 'DynamoDBReadLatency',
        Value: results.metrics.dynamodb.readLatency,
        Unit: 'Milliseconds',
      });
      metrics.push({
        MetricName: 'DynamoDBWriteLatency',
        Value: results.metrics.dynamodb.writeLatency,
        Unit: 'Milliseconds',
      });

      // API Gateway metrics
      metrics.push({
        MetricName: 'ApiGatewayP99Latency',
        Value: results.metrics.apiGateway.p99Latency,
        Unit: 'Milliseconds',
      });
      metrics.push({
        MetricName: 'ApiGatewayThroughput',
        Value: results.metrics.apiGateway.requestThroughput,
        Unit: 'Count/Second',
      });

      // CloudFront metrics
      metrics.push({
        MetricName: 'CloudFrontTTFB',
        Value: results.metrics.cloudFront.ttfb,
        Unit: 'Milliseconds',
      });
      metrics.push({
        MetricName: 'CloudFrontCacheHitRatio',
        Value: results.metrics.cloudFront.cacheHitRatio,
        Unit: 'Percent',
      });

      await this.cloudWatch.send(
        new PutMetricDataCommand({
          Namespace: 'MindBurn/PerformanceBenchmark',
          MetricData: metrics.map(metric => ({
            ...metric,
            Timestamp: timestamp,
            Dimensions: [
              {
                Name: 'Region',
                Value: results.region,
              },
            ],
          })),
        })
      );

      this.logger.info('Benchmark results published', { region: results.region });
    } catch (error) {
      this.logger.error('Failed to publish benchmark results', { error });
      throw error;
    }
  }

  async analyzeBenchmarkResults(results: BenchmarkResult[]): Promise<{
    recommendations: string[];
    bottlenecks: string[];
    optimizationOpportunities: string[];
  }> {
    const analysis = {
      recommendations: [],
      bottlenecks: [],
      optimizationOpportunities: [],
    };

    // Analyze Lambda performance
    const avgColdStart =
      results.reduce((sum, r) => sum + r.metrics.lambda.coldStartLatency, 0) / results.length;
    if (avgColdStart > 1000) {
      analysis.bottlenecks.push('High Lambda cold start latency');
      analysis.recommendations.push('Consider using provisioned concurrency or Lambda SnapStart');
    }

    // Analyze DynamoDB performance
    const avgReadLatency =
      results.reduce((sum, r) => sum + r.metrics.dynamodb.readLatency, 0) / results.length;
    if (avgReadLatency > 10) {
      analysis.bottlenecks.push('High DynamoDB read latency');
      analysis.recommendations.push('Consider implementing DAX or adjusting read capacity');
    }

    // Analyze API Gateway performance
    const avgP99Latency =
      results.reduce((sum, r) => sum + r.metrics.apiGateway.p99Latency, 0) / results.length;
    if (avgP99Latency > 1000) {
      analysis.bottlenecks.push('High API Gateway p99 latency');
      analysis.recommendations.push('Enable API caching and optimize Lambda execution');
    }

    // Analyze CloudFront performance
    const avgCacheHitRatio =
      results.reduce((sum, r) => sum + r.metrics.cloudFront.cacheHitRatio, 0) / results.length;
    if (avgCacheHitRatio < 80) {
      analysis.optimizationOpportunities.push('Low CloudFront cache hit ratio');
      analysis.recommendations.push('Review cache settings and TTL configurations');
    }

    return analysis;
  }
}
