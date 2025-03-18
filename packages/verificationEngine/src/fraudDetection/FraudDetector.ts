import { DynamoDB, CloudWatch } from 'aws-sdk';
import { 
  DeviceFingerprint, 
  WorkerActivity, 
  FraudDetectionResult, 
  WorkerMetrics,
  FraudDetectionConfig,
  RiskThresholds,
  FraudLevel
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
    CRITICAL: 0.9
  };

  private readonly dynamodb: DynamoDB.DocumentClient;
  private readonly cloudwatch: CloudWatch;
  private readonly config: FraudDetectionConfig;

  constructor(
    dynamodbClient?: DynamoDB.DocumentClient,
    cloudwatchClient?: CloudWatch,
    config?: Partial<FraudDetectionConfig>
  ) {
    this.dynamodb = dynamodbClient || new DynamoDB.DocumentClient();
    this.cloudwatch = cloudwatchClient || new CloudWatch();
    
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
      ...config
    };
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
    const {
      workerId,
      taskId,
      taskType,
      content,
      deviceFingerprint,
      ipAddress,
      processingTime
    } = params;

    // Get worker activities and metrics
    const [recentActivity, workerMetrics] = await Promise.all([
      this.getRecentActivity(workerId),
      this.getWorkerMetrics(workerId)
    ]);

    // Parallel risk assessment - run all detection strategies concurrently
    const [
      timeBasedRisk,
      patternBasedRisk,
      networkRisk,
      contentRisk
    ] = await Promise.all([
      this.detectTimeBasedAnomalies(workerId, processingTime, recentActivity),
      this.detectPatternAnomalies(workerId, taskType, recentActivity),
      ipAddress && deviceFingerprint 
        ? this.detectNetworkAnomalies(ipAddress, deviceFingerprint) 
        : Promise.resolve(0),
      this.detectContentAnomalies(content, workerMetrics)
    ]);

    // Calculate weighted risk score
    const riskScore = this.calculateWeightedRiskScore({
      timeBasedRisk,
      patternBasedRisk,
      networkRisk,
      contentRisk
    });

    // Determine fraud level and actions
    const fraudLevel = this.determineFraudLevel(riskScore);
    const reasons = this.generateReasons({
      timeBasedRisk,
      patternBasedRisk, 
      networkRisk,
      contentRisk
    });
    const actions = this.determineActions(fraudLevel);

    // Record detection event for analytics and auditing
    await this.recordDetectionEvent({
      workerId,
      taskId,
      riskScore,
      fraudLevel,
      signals: {
        time: timeBasedRisk,
        pattern: patternBasedRisk,
        network: networkRisk,
        content: contentRisk
      }
    });

    return {
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
        quality: contentRisk
      }
    };
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
    const avgProcessingTime = recentActivity.reduce(
      (sum, activity) => sum + activity.processingTime, 
      0
    ) / recentActivity.length;

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
    const taskTypes = recentActivity.reduce((counts, activity) => {
      counts[activity.taskType] = (counts[activity.taskType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const mainTaskType = Object.entries(taskTypes).sort((a, b) => b[1] - a[1])[0];
    const mainTaskTypeRatio = mainTaskType[1] / recentActivity.length;
    
    if (mainTaskTypeRatio > 0.9) {
      return 0.6; // High concentration on a single task type
    }

    // 3. Check for uniform decision patterns (always approve or reject)
    const decisions = recentActivity.reduce((counts, activity) => {
      counts[activity.decision] = (counts[activity.decision] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
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
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    const uniqueIntervals = new Set(intervals).size;
    const uniqueRatio = uniqueIntervals / intervals.length;
    
    if (uniqueRatio < 0.3 && intervals.length > 5) {
      return 0.9; // Very suspicious timing pattern
    }

    return 0; // No pattern anomalies detected
  }

  /**
   * Detects network-based anomalies related to IP address and device
   */
  private async detectNetworkAnomalies(
    ipAddress: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<number> {
    // This would ideally use external services for IP intelligence
    // For this implementation, we simulate with basic checks
    
    // 1. Check for multiple accounts using the same IP
    const ipUsageData = await this.getIPUsageData(ipAddress);
    if (ipUsageData.uniqueWorkers > 5) {
      return 0.8; // Multiple accounts from same IP
    }
    
    // 2. Check browser fingerprint consistency
    const fingerprintData = await this.getFingerprintData(deviceFingerprint);
    if (fingerprintData.associatedWorkers.length > 3) {
      return 0.7; // Same device used by multiple workers
    }
    
    // 3. Check for inconsistent timezone/language settings
    const isTimezoneConsistent = this.isTimezoneConsistent(
      deviceFingerprint.timezone, 
      ipAddress
    );
    
    if (!isTimezoneConsistent) {
      return 0.5; // Possible VPN/proxy use
    }
    
    return 0; // No network anomalies detected
  }

  /**
   * Detects anomalies in submitted content
   */
  private async detectContentAnomalies(
    content: any,
    metrics: WorkerMetrics
  ): Promise<number> {
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
   * Calculate weighted risk score based on signal weights
   */
  private calculateWeightedRiskScore(risks: {
    timeBasedRisk: number;
    patternBasedRisk: number;
    networkRisk: number;
    contentRisk: number;
  }): number {
    // Apply weights to risks based on configuration
    return (
      risks.timeBasedRisk * 0.25 +
      risks.patternBasedRisk * this.config.activityPatternWeight +
      risks.networkRisk * this.config.networkSignalsWeight +
      risks.contentRisk * this.config.qualityMetricsWeight
    );
  }

  /**
   * Determines the fraud level based on the risk score
   */
  private determineFraudLevel(riskScore: number): FraudLevel {
    if (riskScore >= this.RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (riskScore >= this.RISK_THRESHOLDS.HIGH) return 'HIGH';
    if (riskScore >= this.RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generates human-readable reasons for the fraud detection result
   */
  private generateReasons(risks: {
    timeBasedRisk: number;
    patternBasedRisk: number;
    networkRisk: number;
    contentRisk: number;
  }): string[] {
    const reasons: string[] = [];
    
    if (risks.timeBasedRisk > this.RISK_THRESHOLDS.MEDIUM) {
      reasons.push('Abnormal task processing time detected');
    }
    
    if (risks.patternBasedRisk > this.RISK_THRESHOLDS.MEDIUM) {
      reasons.push('Suspicious activity patterns detected');
    }
    
    if (risks.networkRisk > this.RISK_THRESHOLDS.MEDIUM) {
      reasons.push('Network or device anomalies detected');
    }
    
    if (risks.contentRisk > this.RISK_THRESHOLDS.MEDIUM) {
      reasons.push('Content submission anomalies detected');
    }
    
    return reasons;
  }

  /**
   * Determines actions to take based on the fraud level
   */
  private determineActions(fraudLevel: FraudLevel): string[] {
    const actions = [];
    
    switch (fraudLevel) {
      case 'CRITICAL':
        actions.push(
          'SUSPEND_ACCOUNT',
          'INVALIDATE_RECENT_SUBMISSIONS',
          'BLOCK_PAYMENTS',
          'TRIGGER_MANUAL_REVIEW'
        );
        break;
      case 'HIGH':
        actions.push(
          'INCREASE_VERIFICATION_REQUIREMENTS',
          'RESTRICT_TASK_ACCESS',
          'FLAG_FOR_REVIEW'
        );
        break;
      case 'MEDIUM':
        actions.push(
          'ENABLE_ENHANCED_MONITORING',
          'REQUIRE_ADDITIONAL_VERIFICATION'
        );
        break;
      case 'LOW':
        actions.push('MONITOR');
        break;
    }
    
    return actions;
  }

  /**
   * Records a fraud detection event for analytics and auditing
   */
  private async recordDetectionEvent(event: any): Promise<void> {
    try {
      await Promise.all([
        this.dynamodb.put({
          TableName: 'FraudDetectionEvents',
          Item: {
            ...event,
            timestamp: Date.now()
          }
        }).promise(),
        
        this.cloudwatch.putMetricData({
          Namespace: 'FraudDetection',
          MetricData: [{
            MetricName: 'RiskScore',
            Value: event.riskScore,
            Unit: 'None',
            Dimensions: [
              { Name: 'WorkerId', Value: event.workerId },
              { Name: 'FraudLevel', Value: event.fraudLevel }
            ]
          }]
        }).promise()
      ]);
    } catch (error) {
      console.error('Failed to record fraud detection event:', error);
    }
  }

  /**
   * Calculate confidence level based on risk score
   */
  private calculateConfidence(riskScore: number): number {
    // Higher risk scores have higher confidence levels
    // For example, a risk score of 0.9 would result in a confidence of 0.9
    // A borderline score of 0.5 would have lower confidence
    return Math.abs(riskScore - 0.5) * 2;
  }

  /**
   * Retrieves recent activity for a worker
   */
  private async getRecentActivity(workerId: string): Promise<WorkerActivity[]> {
    const nowMs = Date.now();
    const timeWindowMs = this.config.timeWindowMinutes * 60 * 1000;
    
    try {
      const result = await this.dynamodb.query({
        TableName: 'WorkerActivities',
        KeyConditionExpression: 'workerId = :workerId AND #ts > :startTime',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':workerId': workerId,
          ':startTime': nowMs - timeWindowMs
        }
      }).promise();
      
      return (result.Items || []) as WorkerActivity[];
    } catch (error) {
      console.error('Failed to retrieve worker activity:', error);
      return [];
    }
  }

  /**
   * Retrieves metrics for a worker
   */
  private async getWorkerMetrics(workerId: string): Promise<WorkerMetrics | null> {
    try {
      const result = await this.dynamodb.get({
        TableName: 'WorkerMetrics',
        Key: { workerId }
      }).promise();
      
      return result.Item as WorkerMetrics;
    } catch (error) {
      console.error('Failed to retrieve worker metrics:', error);
      return null;
    }
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
    return activities.length / Math.max(timeSpanHours, 1/60); // Minimum 1 minute
  }

  // Placeholder methods that would be implemented with real logic in production
  
  private async getIPUsageData(ipAddress: string): Promise<{ uniqueWorkers: number }> {
    // Simulate IP usage lookup
    return { uniqueWorkers: Math.floor(Math.random() * 10) };
  }
  
  private async getFingerprintData(fingerprint: DeviceFingerprint): Promise<{ associatedWorkers: string[] }> {
    // Simulate fingerprint lookup
    return { associatedWorkers: [] };
  }
  
  private isTimezoneConsistent(timezone: string, ipAddress: string): boolean {
    // Simulate timezone consistency check
    return Math.random() > 0.2;
  }
  
  private async calculateContentSimilarity(content: any): Promise<number> {
    // Simulate content similarity calculation
    return Math.random();
  }
  
  private checkExpertiseConsistency(content: any, expertiseLevel: string): number {
    // Simulate expertise consistency check
    return Math.random() * 0.5;
  }
} 