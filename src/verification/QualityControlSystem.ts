import { DynamoDB, CloudWatch, EventBridge } from 'aws-sdk';
import { ML } from '../services/ML';
import { Redis } from '../services/Redis';
import { IpIntelligence } from '../services/IpIntelligence';
import { MetricsCollector } from './MetricsCollector';
import { MetricsPublisher } from './MetricsPublisher';
import { FraudDetector } from './FraudDetector';
import {
  QualityMetrics,
  WorkerProfile,
  TaskSubmission,
  QualityControlResult,
  GoldenSetTask,
  DeviceFingerprint,
  FraudDetectionResult,
  WorkerMetrics,
  ExpertiseLevel,
} from './types';

export class QualityControlSystem {
  private readonly QUALITY_THRESHOLDS = {
    EXCELLENT: 0.9,
    GOOD: 0.8,
    ACCEPTABLE: 0.7,
    POOR: 0.6,
  };

  private readonly FRAUD_THRESHOLDS = {
    LOW: 0.3,
    MEDIUM: 0.5,
    HIGH: 0.7,
    CRITICAL: 0.9,
  };

  private readonly REPUTATION_WEIGHTS = {
    ACCURACY: 0.4,
    CONSISTENCY: 0.2,
    SPEED: 0.1,
    PEER_REVIEW: 0.2,
    TASK_COMPLEXITY: 0.1,
  };

  private readonly WARNING_LEVELS = {
    NOTICE: 'NOTICE',
    WARNING: 'WARNING',
    SEVERE: 'SEVERE',
    CRITICAL: 'CRITICAL',
  };

  constructor(
    private dynamodb: DynamoDB.DocumentClient,
    private cloudwatch: CloudWatch,
    private eventBridge: EventBridge,
    private ml: ML,
    private redis: Redis,
    private ipIntelligence: IpIntelligence,
    private metricsCollector: MetricsCollector,
    private metricsPublisher: MetricsPublisher,
    private fraudDetector: FraudDetector,
    private config = {
      goldenSetRatio: 0.1,
      minTasksForEvaluation: 20,
      consistencyWindowHours: 24,
      peerReviewThreshold: 0.8,
      qualityScoreDecayFactor: 0.95,
      timeWeightFactor: 0.3,
      accuracyWeight: 0.4,
      consistencyWeight: 0.3,
      peerReviewWeight: 0.3,
      maxWarningLevel: 3,
      warningExpiryDays: 30,
      deviceFingerprintWeight: 0.3,
      ipReputationWeight: 0.3,
      behaviorPatternWeight: 0.4,
      minReputationForExpertise: 0.8,
      expertisePromotionThreshold: 50,
      expertiseDemotionThreshold: 0.6,
    }
  ) {}

  async evaluateSubmission(params: {
    workerId: string;
    taskId: string;
    submission: TaskSubmission;
    isGoldenSet: boolean;
  }): Promise<QualityControlResult> {
    try {
      const { workerId, taskId, submission, isGoldenSet } = params;

      // Parallel evaluations
      const [
        fraudDetection,
        accuracyScore,
        consistencyScore,
        timeQualityScore,
        peerReviewScore,
        workerProfile,
      ] = await Promise.all([
        this.detectFraud(submission),
        this.evaluateAccuracy(submission, isGoldenSet),
        this.evaluateConsistency(workerId, submission),
        this.evaluateTimeQuality(submission),
        this.evaluatePeerReviews(taskId),
        this.getWorkerProfile(workerId),
      ]);

      // Handle fraud detection
      if (fraudDetection.isFraudulent) {
        await this.handleFraudulentSubmission(workerId, fraudDetection);
        throw new Error('Submission rejected due to fraudulent activity');
      }

      // Calculate quality score
      const qualityScore = this.calculateQualityScore({
        accuracyScore,
        consistencyScore,
        timeQualityScore,
        peerReviewScore,
      });

      // Determine quality level and actions
      const qualityLevel = this.determineQualityLevel(qualityScore);
      const recommendations = this.generateRecommendations(qualityLevel, fraudDetection.riskScore);

      // Update worker profile and reputation
      await this.updateWorkerProfile(workerId, {
        qualityScore,
        accuracyScore,
        consistencyScore,
        timeQualityScore,
        peerReviewScore,
        fraudRiskScore: fraudDetection.riskScore,
      });

      // Update worker expertise level if needed
      await this.updateWorkerExpertise(workerId, workerProfile, qualityScore);

      // Record metrics
      await this.recordMetrics({
        workerId,
        taskId,
        qualityScore,
        qualityLevel,
        fraudDetection,
        metrics: {
          accuracy: accuracyScore,
          consistency: consistencyScore,
          timeQuality: timeQualityScore,
          peerReview: peerReviewScore,
        },
      });

      return {
        qualityScore,
        qualityLevel,
        recommendations,
        metrics: {
          accuracy: accuracyScore,
          consistency: consistencyScore,
          timeQuality: timeQualityScore,
          peerReview: peerReviewScore,
        },
      };
    } catch (error) {
      await this.handleError(error, params);
      throw error;
    }
  }

  private async detectFraud(submission: TaskSubmission): Promise<FraudDetectionResult> {
    const deviceFingerprint = submission.metadata.deviceFingerprint;
    const ipAddress = submission.metadata.ipAddress;

    // Parallel fraud checks
    const [deviceRisk, ipRisk, behaviorRisk] = await Promise.all([
      this.evaluateDeviceFingerprint(deviceFingerprint),
      this.evaluateIpReputation(ipAddress),
      this.evaluateBehaviorPatterns(submission),
    ]);

    // Calculate weighted risk score
    const riskScore =
      deviceRisk * this.config.deviceFingerprintWeight +
      ipRisk * this.config.ipReputationWeight +
      behaviorRisk * this.config.behaviorPatternWeight;

    // Determine fraud level
    const fraudLevel = this.determineFraudLevel(riskScore);

    return {
      isFraudulent: riskScore >= this.FRAUD_THRESHOLDS.HIGH,
      riskScore,
      fraudLevel,
      actions: this.determineFraudActions(fraudLevel),
      signals: {
        reputation: ipRisk,
        activity: behaviorRisk,
        network: deviceRisk,
        quality: submission.confidence,
      },
    };
  }

  private async evaluateDeviceFingerprint(fingerprint: DeviceFingerprint): Promise<number> {
    // Check for suspicious device characteristics
    const suspiciousSignals = [
      !fingerprint.canvas, // Canvas fingerprinting blocked
      !fingerprint.webgl, // WebGL fingerprinting blocked
      fingerprint.fonts.length < 10, // Limited fonts
      !fingerprint.audio, // Audio fingerprinting blocked
      fingerprint.plugins.length === 0, // No plugins
    ];

    const riskScore = suspiciousSignals.filter(Boolean).length / suspiciousSignals.length;

    // Check for known malicious fingerprints in Redis cache
    const cachedRisk = await this.redis.get(`device:${fingerprint.canvas}`);
    if (cachedRisk) {
      return Math.max(riskScore, parseFloat(cachedRisk));
    }

    return riskScore;
  }

  private async evaluateIpReputation(ipAddress: string): Promise<number> {
    const ipIntel = await this.ipIntelligence.checkIp(ipAddress);

    // Normalize risk factors
    const riskFactors = {
      proxy: ipIntel.isProxy ? 0.8 : 0,
      datacenter: ipIntel.isDatacenter ? 0.6 : 0,
      vpn: ipIntel.isVpn ? 0.7 : 0,
      tor: ipIntel.isTor ? 0.9 : 0,
      malicious: ipIntel.isMalicious ? 1.0 : 0,
    };

    return Math.max(...Object.values(riskFactors));
  }

  private async evaluateBehaviorPatterns(submission: TaskSubmission): Promise<number> {
    const recentActivity = await this.getRecentActivity(submission.workerId);

    // Check for suspicious patterns
    const patterns = {
      rapidSubmissions: this.checkRapidSubmissions(recentActivity),
      consistentTiming: this.checkConsistentTiming(recentActivity),
      linearProgression: this.checkLinearProgression(recentActivity),
      taskTypeVariation: this.checkTaskTypeVariation(recentActivity),
    };

    return Object.values(patterns).reduce((max, score) => Math.max(max, score), 0);
  }

  private checkRapidSubmissions(activities: WorkerActivity[]): number {
    if (activities.length < 2) return 0;

    const intervals = activities
      .slice(1)
      .map((activity, i) => activity.timestamp - activities[i].timestamp);

    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length
    );

    return avgInterval < 1000
      ? 0.9 // Less than 1 second
      : stdDev < 100
        ? 0.7 // Very consistent timing
        : 0;
  }

  private checkConsistentTiming(activities: WorkerActivity[]): number {
    if (activities.length < 5) return 0;

    const processingTimes = activities.map(a => a.processingTime);
    const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
    const variance =
      processingTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) /
      processingTimes.length;

    return variance < 100
      ? 0.8 // Suspiciously consistent
      : variance < 1000
        ? 0.4 // Somewhat consistent
        : 0;
  }

  private checkLinearProgression(activities: WorkerActivity[]): number {
    if (activities.length < 10) return 0;

    const times = activities.map(a => a.processingTime);
    const correlation = this.calculateCorrelation(
      times,
      Array.from({ length: times.length }, (_, i) => i)
    );

    return Math.abs(correlation) > 0.95
      ? 0.9 // Almost perfect linear progression
      : Math.abs(correlation) > 0.8
        ? 0.6 // Strong linear progression
        : 0;
  }

  private checkTaskTypeVariation(activities: WorkerActivity[]): number {
    const typeCounts = activities.reduce(
      (counts, activity) => {
        counts[activity.taskType] = (counts[activity.taskType] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    const totalTasks = activities.length;
    const maxTypeRatio = Math.max(...Object.values(typeCounts)) / totalTasks;

    return maxTypeRatio > 0.9
      ? 0.7 // Over 90% same task type
      : maxTypeRatio > 0.8
        ? 0.4 // Over 80% same task type
        : 0;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b);
    const sumY = y.reduce((a, b) => a + b);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    return (
      (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    );
  }

  private async updateWorkerExpertise(
    workerId: string,
    profile: WorkerProfile,
    qualityScore: number
  ): Promise<void> {
    const reputationScore = await this.calculateReputationScore(profile);

    if (
      reputationScore >= this.config.minReputationForExpertise &&
      profile.tasksCompleted >= this.config.expertisePromotionThreshold
    ) {
      // Consider promotion
      const newLevel = this.determineExpertiseLevel(profile.expertiseLevel, qualityScore);
      if (newLevel !== profile.expertiseLevel) {
        await this.updateWorkerExpertiseLevel(workerId, newLevel);
        await this.notifyExpertiseLevelChange(workerId, profile.expertiseLevel, newLevel);
      }
    } else if (qualityScore < this.config.expertiseDemotionThreshold) {
      // Consider demotion
      const newLevel = this.determineExpertiseLevel(profile.expertiseLevel, qualityScore, true);
      if (newLevel !== profile.expertiseLevel) {
        await this.updateWorkerExpertiseLevel(workerId, newLevel);
        await this.notifyExpertiseLevelChange(workerId, profile.expertiseLevel, newLevel);
      }
    }
  }

  private determineExpertiseLevel(
    currentLevel: ExpertiseLevel,
    qualityScore: number,
    isDemotion = false
  ): ExpertiseLevel {
    const levels = [
      ExpertiseLevel.NOVICE,
      ExpertiseLevel.INTERMEDIATE,
      ExpertiseLevel.ADVANCED,
      ExpertiseLevel.EXPERT,
      ExpertiseLevel.MASTER,
    ];

    const currentIndex = levels.indexOf(currentLevel);

    if (isDemotion) {
      if (qualityScore < this.QUALITY_THRESHOLDS.POOR) {
        return levels[Math.max(0, currentIndex - 2)];
      } else if (qualityScore < this.QUALITY_THRESHOLDS.ACCEPTABLE) {
        return levels[Math.max(0, currentIndex - 1)];
      }
    } else {
      if (qualityScore >= this.QUALITY_THRESHOLDS.EXCELLENT) {
        return levels[Math.min(levels.length - 1, currentIndex + 1)];
      }
    }

    return currentLevel;
  }

  private async calculateReputationScore(profile: WorkerProfile): Promise<number> {
    const weights = this.REPUTATION_WEIGHTS;

    return (
      profile.accuracyScore * weights.ACCURACY +
      profile.consistencyScore * weights.CONSISTENCY +
      profile.speedScore * weights.SPEED +
      profile.peerReviewScore * weights.PEER_REVIEW +
      profile.complexityScore * weights.TASK_COMPLEXITY
    );
  }

  private async handleFraudulentSubmission(
    workerId: string,
    fraudDetection: FraudDetectionResult
  ): Promise<void> {
    // Record fraud incident
    await this.recordFraudIncident(workerId, fraudDetection);

    // Apply immediate restrictions
    await this.applyRestrictions(workerId, fraudDetection.fraudLevel);

    // Emit fraud detection event
    await this.emitFraudEvent(workerId, fraudDetection);

    // Update worker warning level
    await this.updateWorkerWarningLevel(workerId, fraudDetection.fraudLevel);
  }

  private async applyRestrictions(workerId: string, fraudLevel: string): Promise<void> {
    const restrictions = {
      LOW: {
        increasedMonitoring: true,
      },
      MEDIUM: {
        increasedMonitoring: true,
        restrictedTaskTypes: true,
      },
      HIGH: {
        increasedMonitoring: true,
        restrictedTaskTypes: true,
        temporarySuspension: 24, // hours
      },
      CRITICAL: {
        permanentBan: true,
      },
    };

    const restriction = restrictions[fraudLevel];
    await this.updateWorkerRestrictions(workerId, restriction);
  }

  private async emitFraudEvent(workerId: string, detection: FraudDetectionResult): Promise<void> {
    await this.eventBridge
      .putEvents({
        Entries: [
          {
            Source: 'aletheia.quality-control',
            DetailType: 'FraudDetected',
            Detail: JSON.stringify({
              workerId,
              fraudLevel: detection.fraudLevel,
              riskScore: detection.riskScore,
              signals: detection.signals,
              timestamp: Date.now(),
            }),
            EventBusName: 'aletheia',
          },
        ],
      })
      .promise();
  }

  private async recordMetrics(metrics: any): Promise<void> {
    await this.metricsCollector.collect({
      timestamp: Date.now(),
      workerId: metrics.workerId,
      taskId: metrics.taskId,
      qualityScore: metrics.qualityScore,
      qualityLevel: metrics.qualityLevel,
      fraudRisk: metrics.fraudDetection.riskScore,
      accuracyScore: metrics.metrics.accuracy,
      consistencyScore: metrics.metrics.consistency,
      timeQualityScore: metrics.metrics.timeQuality,
      peerReviewScore: metrics.metrics.peerReview,
    });

    await this.metricsPublisher.publish('QualityControl', metrics);
  }

  private async handleError(error: Error, context: any): Promise<void> {
    console.error('Quality control error:', error, context);

    await this.cloudwatch
      .putMetricData({
        Namespace: 'Aletheia/QualityControl',
        MetricData: [
          {
            MetricName: 'ProcessingError',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
              {
                Name: 'ErrorType',
                Value: error.name,
              },
              {
                Name: 'WorkerId',
                Value: context.workerId,
              },
            ],
          },
        ],
      })
      .promise();
  }

  private async createCloudWatchAlarms(): Promise<void> {
    const alarms = [
      {
        AlarmName: 'HighFraudDetectionRate',
        MetricName: 'FraudDetections',
        Threshold: 10,
        Period: 300, // 5 minutes
        EvaluationPeriods: 2,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      },
      {
        AlarmName: 'LowQualitySubmissions',
        MetricName: 'QualityScore',
        Threshold: 0.6,
        Period: 300,
        EvaluationPeriods: 3,
        ComparisonOperator: 'LessThanThreshold',
        TreatMissingData: 'missing',
      },
      {
        AlarmName: 'HighErrorRate',
        MetricName: 'ProcessingError',
        Threshold: 5,
        Period: 300,
        EvaluationPeriods: 2,
        ComparisonOperator: 'GreaterThanThreshold',
        TreatMissingData: 'notBreaching',
      },
    ];

    await Promise.all(
      alarms.map(alarm =>
        this.cloudwatch
          .putMetricAlarm({
            ...alarm,
            Namespace: 'Aletheia/QualityControl',
            Statistic: 'Sum',
            ActionsEnabled: true,
            AlarmActions: [process.env.ALARM_SNS_TOPIC_ARN],
            Dimensions: [
              {
                Name: 'Environment',
                Value: process.env.ENVIRONMENT || 'production',
              },
            ],
          })
          .promise()
      )
    );
  }
}
