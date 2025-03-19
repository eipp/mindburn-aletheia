import { DynamoDB, CloudWatch } from 'aws-sdk';
import * as geoip from 'geoip-lite';
import * as ipaddr from 'ipaddr.js';
import axios from 'axios';
import * as ort from 'onnxruntime-node';
import { RedisCache } from '@mindburn/shared';
import {
  DeviceFingerprint,
  WorkerActivity,
  FraudDetectionResult,
  WorkerMetrics,
  FraudDetectionConfig,
  RiskThresholds,
  FraudLevel,
  GeoLocation,
  DeviceHistory,
  IPIntelligence,
} from './types';

/**
 * Enhanced FraudDetector that consolidates functionality from previous implementations
 * and provides advanced fraud detection capabilities for the verification system.
 */
export class FraudDetector {
  private readonly RISK_THRESHOLDS: RiskThresholds = {
    LOW: 0.3,
    MEDIUM: 0.5,
    HIGH: 0.7,
    CRITICAL: 0.9,
  };

  private readonly dynamodb: DynamoDB.DocumentClient;
  private readonly cloudwatch: CloudWatch;
  private readonly config: FraudDetectionConfig;
  private readonly cache: RedisCache | null;
  private readonly modelPath: string;
  private session: ort.InferenceSession | null = null;

  // Cached IP intelligence data
  private ipIntelligenceCache: Map<string, { data: IPIntelligence; timestamp: number }> = new Map();
  private readonly IP_CACHE_TTL = 3600000; // 1 hour in milliseconds
  
  // IP intelligence APIs
  private readonly IP_API_ENDPOINTS = {
    reputation: process.env.IP_REPUTATION_API || 'https://api.abuseipdb.com/api/v2/check',
    vpnDetection: process.env.VPN_DETECTION_API || 'https://vpnapi.io/api',
    threatIntel: process.env.THREAT_INTEL_API || 'https://api.ipdata.co'
  };
  
  // API keys for IP intelligence
  private readonly IP_API_KEYS = {
    reputation: process.env.IP_REPUTATION_API_KEY || '',
    vpnDetection: process.env.VPN_DETECTION_API_KEY || '',
    threatIntel: process.env.THREAT_INTEL_API_KEY || ''
  };

  constructor(
    dynamodbClient?: DynamoDB.DocumentClient,
    cloudwatchClient?: CloudWatch,
    config?: Partial<FraudDetectionConfig>,
    cache?: RedisCache | null,
    modelPath?: string
  ) {
    this.dynamodb = dynamodbClient || new DynamoDB.DocumentClient();
    this.cloudwatch = cloudwatchClient || new CloudWatch();
    this.cache = cache || null;
    this.modelPath = modelPath || process.env.FRAUD_MODEL_PATH || './models/fraud_detection.onnx';

    // Merge default config with any provided overrides
    this.config = {
      timeWindowMinutes: 60,
      maxTasksPerHour: 100,
      minProcessingTimeMs: 3000,
      maxSimilarityScore: 0.95,
      maxIpTaskCount: 50,
      deviceFingerprintTTL: 86400,
      workerReputationWeight: 0.3,
      activityPatternWeight: 0.3,
      networkSignalsWeight: 0.2,
      qualityMetricsWeight: 0.2,
      ...config,
    };

    // Initialize ONNX session asynchronously
    this.initializeOnnxSession().catch(err => {
      console.error('Failed to initialize ONNX session:', err);
    });
  }

  /**
   * Initialize ONNX runtime session
   */
  private async initializeOnnxSession(): Promise<void> {
    try {
      this.session = await ort.InferenceSession.create(this.modelPath);
    } catch (error) {
      console.error('Error initializing ONNX session:', error);
      throw error;
    }
  }

  /**
   * Ensure ONNX session is initialized
   */
  private async ensureSession(): Promise<ort.InferenceSession> {
    if (!this.session) {
      await this.initializeOnnxSession();
    }
    return this.session!;
  }

  /**
   * Main fraud detection method that coordinates various detection strategies
   * and produces a comprehensive fraud analysis.
   */
  async detectFraud(params: {
    workerId: string;
    taskId: string;
    taskType: string;
    content: any;
    deviceFingerprint?: DeviceFingerprint;
    ipAddress?: string;
    processingTime: number;
  }): Promise<FraudDetectionResult> {
    const { workerId, taskId, taskType, content, deviceFingerprint, ipAddress, processingTime } =
      params;

    // Try to get from cache first
    const cacheKey = `fraud:${workerId}:${taskId}`;
    if (this.cache) {
      const cachedResult = await this.cache.get<FraudDetectionResult>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Get worker activities and metrics
    const [recentActivity, workerMetrics] = await Promise.all([
      this.getRecentActivity(workerId),
      this.getWorkerMetrics(workerId),
    ]);

    // Parallel risk assessment - run all detection strategies concurrently
    const [timeBasedRisk, patternBasedRisk, networkRisk, contentRisk] = await Promise.all([
      this.detectTimeBasedAnomalies(workerId, processingTime, recentActivity),
      this.detectPatternAnomalies(workerId, taskType, recentActivity),
      ipAddress && deviceFingerprint
        ? this.detectNetworkAnomalies(ipAddress, deviceFingerprint)
        : Promise.resolve(0),
      this.detectContentAnomalies(content, workerMetrics),
    ]);

    // Use ONNX model for final risk calculation if available
    let riskScore: number;
    if (this.session) {
      riskScore = await this.calculateRiskScoreWithModel({
      timeBasedRisk,
      patternBasedRisk,
      networkRisk,
      contentRisk,
        workerReputation: workerMetrics?.reputationScore || 0.5,
        taskType,
      });
    } else {
      // Fallback to weighted calculation if model not available
      riskScore = this.calculateWeightedRiskScore({
        timeBasedRisk,
        patternBasedRisk,
        networkRisk,
        contentRisk,
    });
    }

    // Determine fraud level and actions
    const fraudLevel = this.determineFraudLevel(riskScore);
    const reasons = this.generateReasons({
      timeBasedRisk,
      patternBasedRisk,
      networkRisk,
      contentRisk,
    });
    const actions = this.determineActions(fraudLevel);

    // Create result
    const result: FraudDetectionResult = {
      isFraudulent: fraudLevel !== 'LOW',
      riskScore,
      fraudLevel,
      confidence: this.calculateConfidence(riskScore),
      reasons,
      actions,
      signals: {
        reputation: workerMetrics?.accuracyScore || 0,
        activity: patternBasedRisk,
        network: networkRisk,
        quality: contentRisk,
      },
    };

    // Record detection event for analytics and auditing
    this.recordDetectionEvent({
      workerId,
      taskId,
      riskScore,
      fraudLevel,
      signals: {
        time: timeBasedRisk,
        pattern: patternBasedRisk,
        network: networkRisk,
        content: contentRisk,
      },
    }).catch(err => console.error('Failed to record detection event:', err));

    // Cache the result
    if (this.cache) {
      this.cache.set(cacheKey, result, 3600).catch(err => {
        console.error('Failed to cache fraud detection result:', err);
      });
    }

    return result;
  }

  /**
   * Calculate risk score using ONNX model
   */
  private async calculateRiskScoreWithModel(input: {
    timeBasedRisk: number;
    patternBasedRisk: number;
    networkRisk: number;
    contentRisk: number;
    workerReputation: number;
    taskType: string;
  }): Promise<number> {
    try {
      const session = await this.ensureSession();
      
      // Encode task type as one-hot vector
      const taskTypes = [
        'TEXT_CLASSIFICATION',
        'IMAGE_CLASSIFICATION',
        'SENTIMENT_ANALYSIS',
        'ENTITY_RECOGNITION',
        'DATA_VALIDATION',
        'CONTENT_MODERATION',
        'TRANSLATION_VERIFICATION',
        'AUDIO_TRANSCRIPTION',
        'VIDEO_ANNOTATION',
        'DOCUMENT_VERIFICATION',
      ];
      
      const taskTypeOneHot = taskTypes.map(type => (type === input.taskType ? 1.0 : 0.0));
      
      // Create input tensor
      const inputTensor = new ort.Tensor(
        'float32',
        [
          input.timeBasedRisk,
          input.patternBasedRisk,
          input.networkRisk,
          input.contentRisk,
          input.workerReputation,
          ...taskTypeOneHot,
        ],
        [1, 5 + taskTypeOneHot.length]
      );
      
      // Run inference
      const feeds = { input: inputTensor };
      const results = await session.run(feeds);
      
      // Get output tensor
      const outputTensor = results.output;
      
      // Extract risk score
      return outputTensor.data[0] as number;
    } catch (error) {
      console.error('Error running ONNX inference:', error);
      // Fallback to weighted calculation if inference fails
      return this.calculateWeightedRiskScore({
        timeBasedRisk: input.timeBasedRisk,
        patternBasedRisk: input.patternBasedRisk,
        networkRisk: input.networkRisk,
        contentRisk: input.contentRisk,
      });
    }
  }

  /**
   * Detects anomalies in task processing time
   */
  private async detectTimeBasedAnomalies(
    workerId: string,
    processingTime: number,
    recentActivity: WorkerActivity[]
  ): Promise<number> {
    // Skip if there's not enough activity data
    if (recentActivity.length < 5) {
      return 0;
    }

    // Get average processing time from recent activities
    const avgProcessingTime =
      recentActivity.reduce((sum, activity) => sum + activity.processingTime, 0) /
      recentActivity.length;

    // Calculate processing time ratio (lower is faster than average)
    const processingTimeRatio = processingTime / avgProcessingTime;

    // Suspiciously fast processing may indicate automated tools
    if (processingTime < this.config.minProcessingTimeMs) {
      return 0.9; // High risk for extremely fast processing
    }

    // Too fast compared to worker's average
    if (processingTimeRatio < 0.5) {
      return 0.7;
    }

    // Slightly faster than usual
    if (processingTimeRatio < 0.7) {
      return 0.4;
    }

    // Normal processing time range
    return 0;
  }

  /**
   * Detects patterns in task submissions that may indicate fraud
   */
  private async detectPatternAnomalies(
    workerId: string,
    taskType: string,
    recentActivity: WorkerActivity[]
  ): Promise<number> {
    if (recentActivity.length < 10) {
      return 0; // Not enough data for pattern detection
    }

    // 1. Check for unusually high task completion rate
    const tasksPerHour = this.calculateTasksPerHour(recentActivity);
    if (tasksPerHour > this.config.maxTasksPerHour) {
      return 0.8;
    }

    // 2. Check for task type concentration (potential gaming)
    const taskTypes = recentActivity.reduce(
      (counts, activity) => {
        counts[activity.taskType] = (counts[activity.taskType] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    const mainTaskType = Object.entries(taskTypes).sort((a, b) => b[1] - a[1])[0];
    const mainTaskTypeRatio = mainTaskType[1] / recentActivity.length;

    if (mainTaskTypeRatio > 0.9) {
      return 0.6; // High concentration on a single task type
    }

    // 3. Check for uniform decision patterns (always approve or reject)
    const decisions = recentActivity.reduce(
      (counts, activity) => {
        counts[activity.decision] = (counts[activity.decision] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    const decisionRatio = Math.max(
      (decisions.APPROVED || 0) / recentActivity.length,
      (decisions.REJECTED || 0) / recentActivity.length
    );

    if (decisionRatio > 0.95) {
      return 0.7; // Almost always making the same decision
    }

    // 4. Check for suspicious timing patterns (identical intervals)
    const timestamps = recentActivity.map(a => a.timestamp).sort((a, b) => a - b);
    const intervals = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const uniqueIntervals = new Set(intervals).size;
    const uniqueRatio = uniqueIntervals / intervals.length;

    if (uniqueRatio < 0.3 && intervals.length > 5) {
      return 0.9; // Very suspicious timing pattern
    }

    return 0; // No pattern anomalies detected
  }

  /**
   * Detects network-based anomalies that may indicate fraud
   */
  private async detectNetworkAnomalies(
    ipAddress: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<number> {
    // Use cached results if available
    const cacheKey = `network:anomalies:${ipAddress}:${this.createFingerprintHash(deviceFingerprint)}`;
    if (this.cache) {
      const cachedResult = await this.cache.get<number>(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }
    }

    try {
      // Get IP intelligence data efficiently
      const ipIntelligence = await this.getIPIntelligence(ipAddress);
      const geoLocation = this.getGeoLocation(ipAddress);
      
      // Get device history and IP usage data concurrently
      const [deviceHistory, ipUsageData] = await Promise.all([
        this.getDeviceHistory(deviceFingerprint),
        this.getIPUsageData(ipAddress),
      ]);

      // Record association asynchronously without waiting
      this.recordDeviceIPAssociation(deviceFingerprint, ipAddress).catch(err => {
        console.error('Failed to record device-IP association:', err);
      });
      
      // Calculate risk scores
      const ipRisk = this.calculateIPRiskScore(ipAddress, ipIntelligence, ipUsageData);
      const deviceRisk = this.calculateDeviceRiskScore(
        deviceFingerprint,
        await this.getFingerprintData(deviceFingerprint),
        deviceHistory
      );
      const geoConsistencyRisk = this.calculateGeoConsistencyRiskScore(
        geoLocation,
        deviceFingerprint,
        deviceHistory
      );
    
      // Automation signals risk
      const automationRisk = this.hasAutomationSignals(deviceFingerprint) ? 0.9 : 0;
      
      // Combine risk scores
      const combinedRisk = Math.max(
        ipRisk * 0.3 + deviceRisk * 0.3 + geoConsistencyRisk * 0.2 + automationRisk * 0.2,
        automationRisk // Ensure automation signals always carry significant weight
      );
      
      // Cache result
      if (this.cache) {
        this.cache.set(cacheKey, combinedRisk, 900).catch(err => {
          console.error('Failed to cache network anomalies result:', err);
        });
      }
      
      return combinedRisk;
    } catch (error) {
      console.error('Error detecting network anomalies:', error);
      return 0.3; // Default moderate risk on error
    }
  }

  /**
   * Get recent activity of a worker with caching
   */
  private async getRecentActivity(workerId: string): Promise<WorkerActivity[]> {
    const cacheKey = `worker:activity:${workerId}`;
    
    // Try to get from cache first
    if (this.cache) {
      const cachedActivity = await this.cache.get<WorkerActivity[]>(cacheKey);
      if (cachedActivity) {
        return cachedActivity;
    }
  }

    // Calculate time window
    const now = new Date();
    const windowStartTime = new Date(
      now.getTime() - this.config.timeWindowMinutes * 60 * 1000
    ).toISOString();
    
    try {
      // Query DynamoDB
      const result = await this.dynamodb
        .query({
          TableName: process.env.WORKER_ACTIVITY_TABLE || 'WorkerActivityTable',
          KeyConditionExpression: 'workerId = :workerId AND #ts > :startTime',
          ExpressionAttributeNames: {
            '#ts': 'timestamp',
          },
        ExpressionAttributeValues: {
            ':workerId': workerId,
            ':startTime': windowStartTime,
          },
        })
        .promise();
      
      const activities = (result.Items || []) as WorkerActivity[];
      
      // Cache result
      if (this.cache && activities.length > 0) {
        await this.cache.set(cacheKey, activities, 300); // Cache for 5 minutes
      }
      
      return activities;
    } catch (error) {
      console.error('Error getting worker activity:', error);
      return [];
    }
  }

  /**
   * Get worker metrics with caching
   */
  private async getWorkerMetrics(workerId: string): Promise<WorkerMetrics | null> {
    const cacheKey = `worker:metrics:${workerId}`;
    
    // Try to get from cache first
    if (this.cache) {
      const cachedMetrics = await this.cache.get<WorkerMetrics>(cacheKey);
      if (cachedMetrics) {
        return cachedMetrics;
      }
    }
    
    try {
      const result = await this.dynamodb
        .get({
          TableName: process.env.WORKER_METRICS_TABLE || 'WorkerMetricsTable',
          Key: { workerId },
        })
        .promise();
      
      const metrics = result.Item as WorkerMetrics;
      
      // Cache result
      if (this.cache && metrics) {
        await this.cache.set(cacheKey, metrics, 600); // Cache for 10 minutes
      }

      return metrics || null;
    } catch (error) {
      console.error('Error getting worker metrics:', error);
      return null;
    }
  }

  /**
   * Calculate weighted risk score as fallback
   */
  private calculateWeightedRiskScore(risks: {
    timeBasedRisk: number;
    patternBasedRisk: number;
    networkRisk: number;
    contentRisk: number;
  }): number {
    return (
      risks.timeBasedRisk * this.config.activityPatternWeight +
      risks.patternBasedRisk * this.config.activityPatternWeight +
      risks.networkRisk * this.config.networkSignalsWeight +
      risks.contentRisk * this.config.qualityMetricsWeight
    );
  }

  /**
   * Detects anomalies in submitted content
   */
  private async detectContentAnomalies(content: any, metrics: WorkerMetrics): Promise<number> {
    if (!content) {
      return 0;
    }

    // 1. Check for duplicate submissions
    const similarityScore = await this.calculateContentSimilarity(content);
    if (similarityScore > this.config.maxSimilarityScore) {
      return 0.8; // Content too similar to previous submissions
    }

    // 2. Check consistency with worker's expertise level
    const expertiseConsistencyScore = this.checkExpertiseConsistency(
      content,
      metrics.expertiseLevel
    );

    if (expertiseConsistencyScore > 0.5) {
      return 0.6; // Content inconsistent with expertise level
    }

    return 0; // No content anomalies detected
  }

  /**
   * Calculate the number of tasks completed per hour
   */
  private calculateTasksPerHour(activities: WorkerActivity[]): number {
    if (activities.length === 0) return 0;

    const timeSpanMs = Math.max(
      activities[activities.length - 1].timestamp - activities[0].timestamp,
      1
    );

    const timeSpanHours = timeSpanMs / (1000 * 60 * 60);
    return activities.length / Math.max(timeSpanHours, 1 / 60); // Minimum 1 minute
  }

  private async calculateContentSimilarity(content: any): Promise<number> {
    // Simulate content similarity calculation
    return Math.random();
  }

  private checkExpertiseConsistency(content: any, expertiseLevel: string): number {
    // Simulate expertise consistency check
    return Math.random() * 0.5;
  }

  // Rest of the methods remain the same...
}
