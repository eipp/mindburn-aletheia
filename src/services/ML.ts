import { SageMaker } from 'aws-sdk';
import { Redis } from './Redis';
import { 
  TaskSubmission,
  WorkerMetrics,
  DeviceFingerprint,
  QualityMetrics
} from '../verification/types';

export class ML {
  private readonly MODEL_ENDPOINTS = {
    fraudDetection: 'fraud-detection-endpoint',
    qualityPrediction: 'quality-prediction-endpoint',
    patternRecognition: 'pattern-recognition-endpoint',
    anomalyDetection: 'anomaly-detection-endpoint'
  };

  constructor(
    private sagemaker: SageMaker,
    private redis: Redis,
    private config = {
      predictionCacheTTL: 3600,
      batchSize: 50,
      confidenceThreshold: 0.8,
      modelVersions: {
        fraudDetection: 'v2.1',
        qualityPrediction: 'v1.8',
        patternRecognition: 'v1.5',
        anomalyDetection: 'v2.0'
      }
    }
  ) {}

  async predictReputationRisk(params: {
    accuracyHistory: number[];
    taskCompletionRate: number;
    averageQualityScore: number;
    accountAge: number;
    previousViolations: number;
  }): Promise<number> {
    const cacheKey = `reputation_risk:${JSON.stringify(params)}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const prediction = await this.invokeSageMaker(
      this.MODEL_ENDPOINTS.fraudDetection,
      {
        ...params,
        modelVersion: this.config.modelVersions.fraudDetection,
        predictionType: 'REPUTATION_RISK'
      }
    );

    await this.redis.setex(
      cacheKey,
      this.config.predictionCacheTTL,
      JSON.stringify(prediction.riskScore)
    );

    return prediction.riskScore;
  }

  async predictActivityRisk(patterns: {
    speedAnomaly: number;
    taskTypeConcentration: number;
    submissionBursts: number;
    timePatterns: any;
  }): Promise<number> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.fraudDetection,
      {
        ...patterns,
        modelVersion: this.config.modelVersions.fraudDetection,
        predictionType: 'ACTIVITY_RISK'
      }
    ).then(result => result.riskScore);
  }

  async calculateAccuracyScore(params: {
    submission: TaskSubmission;
    expectedResult?: any;
    consensusResult?: any;
    weights?: Record<string, number>;
    criteria?: any;
  }): Promise<number> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.qualityPrediction,
      {
        ...params,
        modelVersion: this.config.modelVersions.qualityPrediction,
        predictionType: 'ACCURACY_SCORE'
      }
    ).then(result => result.accuracyScore);
  }

  async calculateConsistencyScore(params: {
    currentSubmission: TaskSubmission;
    recentSubmissions: TaskSubmission[];
    taskType: string;
  }): Promise<number> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.qualityPrediction,
      {
        ...params,
        modelVersion: this.config.modelVersions.qualityPrediction,
        predictionType: 'CONSISTENCY_SCORE'
      }
    ).then(result => result.consistencyScore);
  }

  async calculateTimeQualityScore(params: {
    expectedTime: number;
    actualTime: number;
    taskComplexity: number;
  }): Promise<number> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.qualityPrediction,
      {
        ...params,
        modelVersion: this.config.modelVersions.qualityPrediction,
        predictionType: 'TIME_QUALITY_SCORE'
      }
    ).then(result => result.timeQualityScore);
  }

  async predictQualityRisk(params: {
    consistencyScore: number;
    similarityScore: number;
    goldenSetPerformance: number;
  }): Promise<number> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.qualityPrediction,
      {
        ...params,
        modelVersion: this.config.modelVersions.qualityPrediction,
        predictionType: 'QUALITY_RISK'
      }
    ).then(result => result.riskScore);
  }

  async detectAnomalies(params: {
    metrics: QualityMetrics[];
    timeWindow: number;
    sensitivity: number;
  }): Promise<{
    anomalies: any[];
    confidence: number;
  }> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.anomalyDetection,
      {
        ...params,
        modelVersion: this.config.modelVersions.anomalyDetection,
        predictionType: 'ANOMALY_DETECTION'
      }
    );
  }

  async recognizePatterns(params: {
    data: any[];
    patternType: string;
    minConfidence: number;
  }): Promise<{
    patterns: any[];
    confidence: number;
  }> {
    return this.invokeSageMaker(
      this.MODEL_ENDPOINTS.patternRecognition,
      {
        ...params,
        modelVersion: this.config.modelVersions.patternRecognition,
        predictionType: 'PATTERN_RECOGNITION'
      }
    );
  }

  private async invokeSageMaker(
    endpointName: string,
    payload: any
  ): Promise<any> {
    try {
      const response = await this.sagemaker.invokeEndpoint({
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(payload)
      }).promise();

      const result = JSON.parse(response.Body.toString());

      if (result.confidence < this.config.confidenceThreshold) {
        console.warn(`Low confidence prediction for ${endpointName}:`, {
          confidence: result.confidence,
          payload
        });
      }

      return result;
    } catch (error) {
      console.error(`SageMaker invocation error for ${endpointName}:`, error);
      throw error;
    }
  }
} 