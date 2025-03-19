import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const s3Client = new S3Client();
const dynamoClient = new DynamoDBClient();
const cloudWatchClient = new CloudWatchClient();
const snsClient = new SNSClient();

// Config from environment variables
const DATA_LAKE_BUCKET = process.env.DATA_LAKE_BUCKET || '';
const METRICS_PATH = process.env.METRICS_PATH || 'processed/verification_metrics/';
const TASKS_TABLE = process.env.TASKS_TABLE || '';
const WORKERS_TABLE = process.env.WORKERS_TABLE || '';
const ALERTS_TOPIC_ARN = process.env.ALERTS_TOPIC_ARN || '';

/**
 * Analyze task metrics and update CloudWatch metrics
 */
export const handler = async (event: any): Promise<any> => {
  console.log('Processing metrics analysis event:', JSON.stringify(event));
  
  try {
    // Extract date range from event or use current date
    const endDate = event.endDate ? new Date(event.endDate) : new Date();
    const startDate = event.startDate 
      ? new Date(event.startDate) 
      : new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Default to last 24 hours
    
    console.log(`Analyzing metrics from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // 1. Load verification metrics data from S3
    const metricsData = await loadMetricsData(startDate, endDate);
    
    // 2. Calculate key performance indicators
    const kpis = calculateKPIs(metricsData);
    
    // 3. Update CloudWatch metrics
    await publishCloudWatchMetrics(kpis);
    
    // 4. Detect anomalies and send alerts if needed
    const anomalies = detectAnomalies(kpis, metricsData);
    if (anomalies.length > 0) {
      await sendAnomalyAlerts(anomalies);
    }
    
    // 5. Update task and worker performance stats in DynamoDB
    await updatePerformanceStats(metricsData);
    
    return {
      statusCode: 200,
      body: {
        analyzedRecords: metricsData.length,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        kpis,
        anomaliesDetected: anomalies.length,
      },
    };
  } catch (error) {
    console.error('Error processing metrics analysis:', error);
    
    return {
      statusCode: 500,
      body: {
        message: 'Error processing metrics analysis',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

/**
 * Load verification metrics data from S3
 */
async function loadMetricsData(startDate: Date, endDate: Date): Promise<any[]> {
  // Implementation would extract relevant data based on partitioned S3 path
  // This is a simplified version
  const partitionKeys = generatePartitionKeys(startDate, endDate);
  const allData: any[] = [];
  
  for (const key of partitionKeys) {
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: DATA_LAKE_BUCKET,
        Key: `${METRICS_PATH}${key}`,
      }));
      
      // Process the S3 object data
      if (response.Body) {
        const content = await response.Body.transformToString();
        const records = content.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        
        allData.push(...records);
      }
    } catch (error) {
      console.warn(`Error loading metrics data for partition ${key}:`, error);
      // Continue with other partitions
    }
  }
  
  return allData;
}

/**
 * Generate S3 partition keys based on date range
 */
function generatePartitionKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getUTCDate()).padStart(2, '0');
    
    keys.push(`year=${year}/month=${month}/day=${day}/`);
    
    // Move to next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  
  return keys;
}

/**
 * Calculate Key Performance Indicators from metrics data
 */
function calculateKPIs(metricsData: any[]): any {
  // Basic KPIs
  const totalVerifications = metricsData.length;
  const accurateVerifications = metricsData.filter(m => m.is_accurate).length;
  const accuracyRate = totalVerifications > 0 ? accurateVerifications / totalVerifications : 0;
  
  // Response time metrics
  const responseTimes = metricsData.map(m => m.response_time_ms);
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : 0;
  
  // Cost metrics
  const totalCost = metricsData.reduce((sum, m) => sum + (m.cost || 0), 0);
  const avgCostPerVerification = totalVerifications > 0 ? totalCost / totalVerifications : 0;
  
  // Group by content type
  const contentTypeStats = metricsData.reduce((acc: Record<string, any>, metric) => {
    const contentType = metric.content_type || 'unknown';
    
    if (!acc[contentType]) {
      acc[contentType] = {
        count: 0,
        accurate: 0,
        totalResponseTime: 0,
        totalCost: 0,
      };
    }
    
    acc[contentType].count++;
    if (metric.is_accurate) acc[contentType].accurate++;
    acc[contentType].totalResponseTime += metric.response_time_ms || 0;
    acc[contentType].totalCost += metric.cost || 0;
    
    return acc;
  }, {});
  
  // Calculate statistics per content type
  Object.keys(contentTypeStats).forEach(contentType => {
    const stats = contentTypeStats[contentType];
    stats.accuracyRate = stats.count > 0 ? stats.accurate / stats.count : 0;
    stats.avgResponseTime = stats.count > 0 ? stats.totalResponseTime / stats.count : 0;
    stats.avgCost = stats.count > 0 ? stats.totalCost / stats.count : 0;
  });
  
  return {
    totalVerifications,
    accuracyRate,
    avgResponseTime,
    avgCostPerVerification,
    contentTypeStats,
  };
}

/**
 * Publish metrics to CloudWatch
 */
async function publishCloudWatchMetrics(kpis: any): Promise<void> {
  const timestamp = new Date();
  
  // Prepare metric data
  const metricData = [
    {
      MetricName: 'VerificationAccuracyRate',
      Value: kpis.accuracyRate * 100, // Convert to percentage
      Unit: 'Percent',
      Dimensions: [{ Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }],
      Timestamp: timestamp,
    },
    {
      MetricName: 'AvgResponseTime',
      Value: kpis.avgResponseTime,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }],
      Timestamp: timestamp,
    },
    {
      MetricName: 'AvgCostPerVerification',
      Value: kpis.avgCostPerVerification,
      Unit: 'None',
      Dimensions: [{ Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }],
      Timestamp: timestamp,
    },
    {
      MetricName: 'TotalVerifications',
      Value: kpis.totalVerifications,
      Unit: 'Count',
      Dimensions: [{ Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }],
      Timestamp: timestamp,
    },
  ];
  
  // Add content type specific metrics
  Object.entries(kpis.contentTypeStats).forEach(([contentType, stats]: [string, any]) => {
    metricData.push(
      {
        MetricName: 'ContentTypeAccuracyRate',
        Value: stats.accuracyRate * 100, // Convert to percentage
        Unit: 'Percent',
        Dimensions: [
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' },
          { Name: 'ContentType', Value: contentType },
        ],
        Timestamp: timestamp,
      },
      {
        MetricName: 'ContentTypeAvgResponseTime',
        Value: stats.avgResponseTime,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' },
          { Name: 'ContentType', Value: contentType },
        ],
        Timestamp: timestamp,
      }
    );
  });
  
  // Publish metrics to CloudWatch
  await cloudWatchClient.send(new PutMetricDataCommand({
    Namespace: 'Mindburn/VerificationMetrics',
    MetricData: metricData,
  }));
}

/**
 * Detect anomalies in metrics data
 */
function detectAnomalies(kpis: any, metricsData: any[]): any[] {
  const anomalies: any[] = [];
  
  // Example anomaly detection rules
  
  // 1. Low accuracy rate (below 75%)
  if (kpis.accuracyRate < 0.75) {
    anomalies.push({
      type: 'LOW_ACCURACY',
      value: kpis.accuracyRate,
      threshold: 0.75,
      severity: 'HIGH',
      message: `Low verification accuracy rate: ${(kpis.accuracyRate * 100).toFixed(2)}%`,
    });
  }
  
  // 2. Unusually high response times (3x average)
  const highResponseTimeThreshold = kpis.avgResponseTime * 3;
  const highResponseTimes = metricsData.filter(m => m.response_time_ms > highResponseTimeThreshold);
  
  if (highResponseTimes.length > 10) {
    anomalies.push({
      type: 'HIGH_RESPONSE_TIMES',
      count: highResponseTimes.length,
      threshold: highResponseTimeThreshold,
      severity: 'MEDIUM',
      message: `${highResponseTimes.length} verifications with unusually high response times detected`,
    });
  }
  
  // 3. Content type specific anomalies
  Object.entries(kpis.contentTypeStats).forEach(([contentType, stats]: [string, any]) => {
    if (stats.count > 20 && stats.accuracyRate < 0.65) {
      anomalies.push({
        type: 'CONTENT_TYPE_LOW_ACCURACY',
        contentType,
        value: stats.accuracyRate,
        threshold: 0.65,
        severity: 'HIGH',
        message: `Low accuracy rate (${(stats.accuracyRate * 100).toFixed(2)}%) for content type: ${contentType}`,
      });
    }
  });
  
  return anomalies;
}

/**
 * Send alerts for detected anomalies
 */
async function sendAnomalyAlerts(anomalies: any[]): Promise<void> {
  if (!ALERTS_TOPIC_ARN) {
    console.warn('No ALERTS_TOPIC_ARN configured, skipping anomaly alerts');
    return;
  }
  
  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'HIGH');
  
  if (highSeverityAnomalies.length > 0) {
    // Send high severity anomalies to SNS
    const message = {
      subject: `[${process.env.ENVIRONMENT || 'dev'}] High Severity Verification Anomalies Detected`,
      message: `${highSeverityAnomalies.length} high severity anomalies detected in verification metrics:`,
      anomalies: highSeverityAnomalies.map(a => a.message).join('\n- '),
      timestamp: new Date().toISOString(),
    };
    
    await snsClient.send(new PublishCommand({
      TopicArn: ALERTS_TOPIC_ARN,
      Subject: message.subject,
      Message: JSON.stringify(message, null, 2),
    }));
  }
}

/**
 * Update task and worker performance statistics in DynamoDB
 */
async function updatePerformanceStats(metricsData: any[]): Promise<void> {
  // Group metrics by worker
  const workerMetrics = metricsData.reduce((acc: Record<string, any[]>, metric) => {
    if (metric.worker_id) {
      if (!acc[metric.worker_id]) {
        acc[metric.worker_id] = [];
      }
      acc[metric.worker_id].push(metric);
    }
    return acc;
  }, {});
  
  // Update worker performance stats
  for (const [workerId, metrics] of Object.entries(workerMetrics)) {
    const totalTasks = metrics.length;
    const accurateTasks = metrics.filter(m => m.is_accurate).length;
    const accuracyRate = totalTasks > 0 ? accurateTasks / totalTasks : 0;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.response_time_ms, 0) / totalTasks;
    
    try {
      await dynamoClient.send(new UpdateItemCommand({
        TableName: WORKERS_TABLE,
        Key: { PK: { S: `WORKER#${workerId}` }, SK: { S: 'METADATA' } },
        UpdateExpression: 'SET AccuracyScore = :accuracy, ResponseTime = :responseTime, ' +
                          'TasksCompleted = TasksCompleted + :tasksCount, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':accuracy': { N: accuracyRate.toString() },
          ':responseTime': { N: avgResponseTime.toString() },
          ':tasksCount': { N: totalTasks.toString() },
          ':updatedAt': { N: Date.now().toString() },
        },
      }));
    } catch (error) {
      console.error(`Error updating worker stats for worker ${workerId}:`, error);
    }
  }
} 