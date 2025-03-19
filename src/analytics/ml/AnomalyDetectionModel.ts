import { S3 } from 'aws-sdk';
import { Lambda } from 'aws-sdk';
import { QualityMetrics } from '../../verification/types';

interface AnomalyDetectionModelConfig {
  modelBucket: string;
  modelKey: string;
  contamination: number;
  featureColumns: string[];
}

interface AnomalyDetectionResponse {
  anomaly_count: number;
  anomalies: Array<{
    index: number;
    score: number;
    timestamp: string;
    metrics: Record<string, number>;
  }>;
}

export class AnomalyDetectionModel {
  private s3: S3;
  private lambda: Lambda;
  private config: AnomalyDetectionModelConfig;
  private initialized: boolean = false;
  private lambdaFunctionName: string = process.env.ANOMALY_DETECTION_LAMBDA || 'aletheia-anomaly-detector';

  constructor(config: AnomalyDetectionModelConfig) {
    this.s3 = new S3();
    this.lambda = new Lambda();
    this.config = config;
  }

  /**
   * Initialize the model by verifying S3 access and Lambda function availability
   */
  async initialize(): Promise<void> {
    try {
      // Check if the model file exists in S3
      await this.s3
        .headObject({
          Bucket: this.config.modelBucket,
          Key: this.config.modelKey,
        })
        .promise();

      // Check if the Lambda function exists
      await this.lambda
        .getFunctionConfiguration({
          FunctionName: this.lambdaFunctionName,
        })
        .promise();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize anomaly detection model:', error);
      throw new Error(`Anomaly detection model initialization failed: ${error.message}`);
    }
  }

  /**
   * Detect anomalies in the provided data
   */
  async detectAnomalies(data: QualityMetrics[]): Promise<AnomalyDetectionResponse> {
    if (!this.initialized) {
      throw new Error('Anomaly detection model not initialized');
    }

    try {
      // Invoke the Lambda function with the data
      const response = await this.lambda
        .invoke({
          FunctionName: this.lambdaFunctionName,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            model_bucket: this.config.modelBucket,
            model_key: this.config.modelKey,
            verification_data: data.map(item => ({
              // Map TypeScript data to the format expected by the Python model
              workerId: item.workerId,
              taskId: item.taskId,
              timestamp: item.timestamp,
              response_time_ms: item.response_time_ms,
              confidence_score: item.confidence_score,
              cost: item.cost,
              is_accurate: item.is_accurate,
              // Include any other fields needed by the model
            })),
          }),
        })
        .promise();

      // Parse and return the result
      const result = JSON.parse(response.Payload as string);
      
      if (result.statusCode !== 200) {
        throw new Error(`Anomaly detection failed: ${result.body?.error || 'Unknown error'}`);
      }

      return JSON.parse(result.body) as AnomalyDetectionResponse;
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      throw error;
    }
  }

  /**
   * Check if a specific metric value is anomalous
   */
  isAnomalous(metricValue: number, metricName: string, threshold: number = 0.05): boolean {
    // This is a simplified check that would normally use the model
    // In a real implementation, this would call the Python model with this specific value
    
    // For now, implement a simple z-score based check as fallback
    // This represents defense in depth if the ML model is unavailable
    if (!this.initialized) {
      // Simplified anomaly check based on statistical thresholds for different metrics
      switch (metricName) {
        case 'response_time_ms':
          // For response time, very low or very high values are suspicious
          return metricValue < 500 || metricValue > 300000;
        case 'confidence_score':
          // For confidence, extremely high scores might be suspicious
          return metricValue > 0.98;
        case 'accuracy_rate':
          // For accuracy, perfect scores throughout might be suspicious
          return metricValue > 0.99;
        default:
          return false;
      }
    }
    
    // If initialized, this would use the actual model
    // But we'll need to fall back to the Lambda for actual analysis
    return false;
  }
} 