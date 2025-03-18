import { Logger } from '@mindburn/shared/logger';
import { 
  WorkerSubmission,
  FraudDetectionResult,
  FraudPattern,
  SuspiciousActivity,
  WorkerBehavior
} from '../types';
import { FraudDetectionError } from '../errors';

export class FraudDetectionService {
  private readonly logger: Logger;
  private readonly thresholds = {
    minTimeSeconds: 10,
    maxTimeSeconds: 3600,
    similarityThreshold: 0.9,
    patternRepetitionThreshold: 0.8,
    suspiciousSpeedThreshold: 0.3, // 30% of average time
    maxConsecutiveSimilar: 3
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'FraudDetection' });
  }

  async analyzeSubmissions(
    submissions: WorkerSubmission[]
  ): Promise<FraudDetectionResult> {
    try {
      const suspiciousActivities: SuspiciousActivity[] = [];

      // Check for time-based anomalies
      const timeAnomalies = this.detectTimeAnomalies(submissions);
      if (timeAnomalies.length > 0) {
        suspiciousActivities.push(...timeAnomalies);
      }

      // Check for pattern repetition
      const patterns = this.detectPatternRepetition(submissions);
      if (patterns.length > 0) {
        suspiciousActivities.push({
          type: 'PATTERN_REPETITION',
          description: 'Repeated submission patterns detected',
          evidence: patterns,
          severity: 'HIGH'
        });
      }

      // Check for worker collusion
      const collusion = await this.detectWorkerCollusion(submissions);
      if (collusion.length > 0) {
        suspiciousActivities.push({
          type: 'WORKER_COLLUSION',
          description: 'Potential worker collusion detected',
          evidence: collusion,
          severity: 'HIGH'
        });
      }

      // Check for automated submissions
      const automation = this.detectAutomation(submissions);
      if (automation.isAutomated) {
        suspiciousActivities.push({
          type: 'AUTOMATED_SUBMISSION',
          description: 'Potential automated submission behavior detected',
          evidence: automation.evidence,
          severity: 'HIGH'
        });
      }

      // Analyze worker behavior patterns
      const behaviorAnalysis = await this.analyzeWorkerBehavior(
        submissions.map(s => s.workerId)
      );

      const result: FraudDetectionResult = {
        hasSuspiciousActivity: suspiciousActivities.length > 0,
        suspiciousActivities,
        riskLevel: this.calculateRiskLevel(suspiciousActivities),
        workerBehaviorAnalysis: behaviorAnalysis,
        timestamp: new Date().toISOString()
      };

      if (result.hasSuspiciousActivity) {
        this.logger.warn('Suspicious activity detected', result);
      }

      return result;
    } catch (error) {
      this.logger.error('Fraud detection analysis failed', { error });
      throw new FraudDetectionError('Failed to analyze submissions', { cause: error });
    }
  }

  private detectTimeAnomalies(
    submissions: WorkerSubmission[]
  ): SuspiciousActivity[] {
    const anomalies: SuspiciousActivity[] = [];

    for (const submission of submissions) {
      const timeSpent = submission.completedAt - submission.startedAt;
      
      // Check for suspiciously fast submissions
      if (timeSpent < this.thresholds.minTimeSeconds * 1000) {
        anomalies.push({
          type: 'SPEED_ANOMALY',
          description: 'Submission completed too quickly',
          evidence: {
            submissionId: submission.submissionId,
            timeSpent,
            threshold: this.thresholds.minTimeSeconds * 1000
          },
          severity: 'MEDIUM'
        });
      }

      // Check for suspiciously slow submissions
      if (timeSpent > this.thresholds.maxTimeSeconds * 1000) {
        anomalies.push({
          type: 'SPEED_ANOMALY',
          description: 'Submission took unusually long',
          evidence: {
            submissionId: submission.submissionId,
            timeSpent,
            threshold: this.thresholds.maxTimeSeconds * 1000
          },
          severity: 'LOW'
        });
      }
    }

    return anomalies;
  }

  private detectPatternRepetition(
    submissions: WorkerSubmission[]
  ): FraudPattern[] {
    const patterns: FraudPattern[] = [];
    const submissionsByWorker = new Map<string, WorkerSubmission[]>();

    // Group submissions by worker
    for (const submission of submissions) {
      const workerSubmissions = submissionsByWorker.get(submission.workerId) || [];
      workerSubmissions.push(submission);
      submissionsByWorker.set(submission.workerId, workerSubmissions);
    }

    // Analyze patterns for each worker
    for (const [workerId, workerSubmissions] of submissionsByWorker.entries()) {
      if (workerSubmissions.length < 2) continue;

      let similarSubmissions = 0;
      let previousResult = JSON.stringify(workerSubmissions[0].result);

      for (let i = 1; i < workerSubmissions.length; i++) {
        const currentResult = JSON.stringify(workerSubmissions[i].result);
        if (this.calculateSimilarity(previousResult, currentResult) > this.thresholds.similarityThreshold) {
          similarSubmissions++;
          if (similarSubmissions >= this.thresholds.maxConsecutiveSimilar) {
            patterns.push({
              workerId,
              type: 'REPEATED_SUBMISSIONS',
              submissionIds: workerSubmissions
                .slice(i - this.thresholds.maxConsecutiveSimilar, i + 1)
                .map(s => s.submissionId),
              confidence: similarSubmissions / workerSubmissions.length
            });
            break;
          }
        } else {
          similarSubmissions = 0;
        }
        previousResult = currentResult;
      }
    }

    return patterns;
  }

  private async detectWorkerCollusion(
    submissions: WorkerSubmission[]
  ): Promise<SuspiciousActivity[]> {
    const suspiciousActivities: SuspiciousActivity[] = [];
    const submissionsByWorker = new Map<string, WorkerSubmission[]>();

    // Group submissions by worker
    for (const submission of submissions) {
      const workerSubmissions = submissionsByWorker.get(submission.workerId) || [];
      workerSubmissions.push(submission);
      submissionsByWorker.set(submission.workerId, workerSubmissions);
    }

    // Compare submissions between workers
    const workers = Array.from(submissionsByWorker.keys());
    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        const worker1Submissions = submissionsByWorker.get(workers[i])!;
        const worker2Submissions = submissionsByWorker.get(workers[j])!;

        const similarity = this.calculateWorkerSubmissionSimilarity(
          worker1Submissions,
          worker2Submissions
        );

        if (similarity > this.thresholds.similarityThreshold) {
          suspiciousActivities.push({
            type: 'WORKER_COLLUSION',
            description: 'High similarity between worker submissions',
            evidence: {
              worker1: workers[i],
              worker2: workers[j],
              similarity
            },
            severity: 'HIGH'
          });
        }
      }
    }

    return suspiciousActivities;
  }

  private detectAutomation(
    submissions: WorkerSubmission[]
  ): {
    isAutomated: boolean;
    evidence?: any;
  } {
    const submissionTimes = submissions.map(s => s.completedAt - s.startedAt);
    const averageTime = submissionTimes.reduce((sum, time) => sum + time, 0) / submissionTimes.length;
    
    // Check for consistent submission times (potential automation)
    const timeVariance = submissionTimes.reduce(
      (variance, time) => variance + Math.pow(time - averageTime, 2),
      0
    ) / submissionTimes.length;

    const standardDeviation = Math.sqrt(timeVariance);
    const coefficientOfVariation = standardDeviation / averageTime;

    // Very low variation in submission times suggests automation
    if (coefficientOfVariation < 0.1) {
      return {
        isAutomated: true,
        evidence: {
          coefficientOfVariation,
          averageTime,
          standardDeviation
        }
      };
    }

    return { isAutomated: false };
  }

  private async analyzeWorkerBehavior(
    workerIds: string[]
  ): Promise<WorkerBehavior[]> {
    // TODO: Implement worker behavior analysis from database
    // This is a placeholder
    return workerIds.map(workerId => ({
      workerId,
      riskScore: 0.1,
      patterns: [],
      lastAnalysis: new Date().toISOString()
    }));
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const longerLength = Math.max(str1.length, str2.length);
    const editDistance = this.levenshteinDistance(str1, str2);
    
    return (longerLength - editDistance) / longerLength;
  }

  private calculateWorkerSubmissionSimilarity(
    submissions1: WorkerSubmission[],
    submissions2: WorkerSubmission[]
  ): number {
    const results1 = submissions1.map(s => JSON.stringify(s.result));
    const results2 = submissions2.map(s => JSON.stringify(s.result));

    let totalSimilarity = 0;
    let comparisons = 0;

    for (const result1 of results1) {
      for (const result2 of results2) {
        totalSimilarity += this.calculateSimilarity(result1, result2);
        comparisons++;
      }
    }

    return totalSimilarity / comparisons;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[str1.length][str2.length];
  }

  private calculateRiskLevel(
    activities: SuspiciousActivity[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const severityScores = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3
    };

    const totalScore = activities.reduce(
      (score, activity) => score + severityScores[activity.severity],
      0
    );

    const averageScore = totalScore / activities.length;

    if (averageScore >= 2.5) return 'HIGH';
    if (averageScore >= 1.5) return 'MEDIUM';
    return 'LOW';
  }
} 