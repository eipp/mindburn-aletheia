import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  WorkerSubmission,
  VerificationResult,
  ConsensusStrategy,
  VerificationStatus,
  ConfidenceLevel,
  QualityMetrics,
  QualityThresholds,
  TaskType,
} from '../types';
import { ValidationError } from '../errors';
import { VerificationStrategyFactory } from './taskVerificationStrategies';

export class VerificationEngine {
  private readonly logger: Logger;
  private readonly qualityThresholds: QualityThresholds = {
    accuracy: {
      low: 0.7,
      medium: 0.85,
      high: 0.95,
    },
    consistency: {
      low: 0.65,
      medium: 0.8,
      high: 0.9,
    },
    speedScore: {
      slow: 0.5,
      medium: 0.75,
      fast: 0.9,
    },
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'VerificationEngine' });
  }

  async processSubmissions(
    task: VerificationTask,
    submissions: WorkerSubmission[]
  ): Promise<VerificationResult> {
    try {
      const strategy = VerificationStrategyFactory.getStrategy(task.type);

      // Validate submissions
      this.validateSubmissions(task, submissions, strategy);

      // Calculate worker metrics
      const workerMetrics = await this.calculateWorkerMetrics(task, submissions, strategy);

      // Apply consensus strategy
      const consensus = await this.applyConsensusStrategy(
        task,
        submissions,
        workerMetrics,
        strategy
      );

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(task, submissions, workerMetrics);

      // Create verification result
      const result: VerificationResult = {
        taskId: task.taskId,
        status: this.determineVerificationStatus(confidenceLevel),
        consensus,
        confidenceLevel,
        workerMetrics,
        fraudDetection: await this.detectFraud(task, submissions),
        processedAt: new Date().toISOString(),
        metadata: {
          submissionCount: submissions.length,
          averageProcessingTime: this.calculateAverageProcessingTime(submissions),
          consensusStrategy: task.consensusStrategy,
        },
      };

      this.logger.info('Verification completed', {
        taskId: task.taskId,
        status: result.status,
        confidenceLevel,
      });

      return result;
    } catch (error) {
      this.logger.error('Verification processing failed', {
        error,
        taskId: task.taskId,
      });
      throw error;
    }
  }

  private validateSubmissions(
    task: VerificationTask,
    submissions: WorkerSubmission[],
    strategy: any
  ): void {
    if (submissions.length < task.requirements.minSubmissions) {
      throw new ValidationError(
        `Insufficient submissions: ${submissions.length}/${task.requirements.minSubmissions}`
      );
    }

    // Validate submission format based on task type
    submissions.forEach(submission => {
      if (!strategy.validateFormat(submission.result)) {
        throw new ValidationError(`Invalid submission format for task type ${task.type}`);
      }
    });
  }

  private async calculateWorkerMetrics(
    task: VerificationTask,
    submissions: WorkerSubmission[],
    strategy: any
  ): Promise<QualityMetrics[]> {
    return Promise.all(
      submissions.map(async submission => {
        const timeSpent = submission.completedAt - submission.startedAt;
        const accuracy = await strategy.calculateAccuracy(submission);
        const consistencyScore = await this.calculateConsistency(task, submission);

        return {
          workerId: submission.workerId,
          submissionId: submission.submissionId,
          accuracy,
          timeSpent,
          consistencyScore,
        };
      })
    );
  }

  private async applyConsensusStrategy(
    task: VerificationTask,
    submissions: WorkerSubmission[],
    metrics: QualityMetrics[],
    strategy: any
  ): Promise<any> {
    switch (task.consensusStrategy) {
      case ConsensusStrategy.MAJORITY:
        return strategy.aggregateResults(submissions);

      case ConsensusStrategy.WEIGHTED:
        return this.applyWeightedConsensus(submissions, metrics, strategy);

      case ConsensusStrategy.UNANIMOUS:
        return this.applyUnanimousConsensus(submissions, strategy);

      default:
        throw new ValidationError(`Unsupported consensus strategy: ${task.consensusStrategy}`);
    }
  }

  private async applyWeightedConsensus(
    submissions: WorkerSubmission[],
    metrics: QualityMetrics[],
    strategy: any
  ): Promise<any> {
    // Calculate weights based on worker metrics
    const weights = metrics.map(
      metric =>
        metric.accuracy * 0.5 +
        metric.consistencyScore * 0.3 +
        this.normalizeTimeScore(metric.timeSpent) * 0.2
    );

    // Apply weights to results
    const weightedResults = submissions.map((submission, index) => ({
      result: submission.result,
      weight: weights[index],
    }));

    // Use strategy to aggregate weighted results
    return strategy.aggregateResults(
      weightedResults.map(wr => ({
        ...submissions[0],
        result: wr.result,
        weight: wr.weight,
      }))
    );
  }

  private async applyUnanimousConsensus(
    submissions: WorkerSubmission[],
    strategy: any
  ): Promise<any> {
    const firstResult = JSON.stringify(submissions[0].result);
    const isUnanimous = submissions.every(
      submission => JSON.stringify(submission.result) === firstResult
    );

    if (!isUnanimous) {
      throw new ValidationError('Unanimous consensus not reached');
    }

    return strategy.aggregateResults([submissions[0]]);
  }

  private calculateConfidenceLevel(
    task: VerificationTask,
    submissions: WorkerSubmission[],
    metrics: QualityMetrics[]
  ): ConfidenceLevel {
    // Calculate average metrics
    const avgAccuracy = this.average(metrics.map(m => m.accuracy));
    const avgConsistency = this.average(metrics.map(m => m.consistencyScore));
    const submissionAgreement = this.calculateSubmissionAgreement(submissions);

    // Weight the factors
    const confidenceScore = avgAccuracy * 0.4 + avgConsistency * 0.3 + submissionAgreement * 0.3;

    // Map score to confidence level
    if (confidenceScore >= 0.9) return ConfidenceLevel.HIGH;
    if (confidenceScore >= 0.7) return ConfidenceLevel.MEDIUM;
    return ConfidenceLevel.LOW;
  }

  private determineVerificationStatus(confidenceLevel: ConfidenceLevel): VerificationStatus {
    switch (confidenceLevel) {
      case ConfidenceLevel.HIGH:
        return VerificationStatus.COMPLETED;
      case ConfidenceLevel.MEDIUM:
        return VerificationStatus.NEEDS_REVIEW;
      default:
        return VerificationStatus.FAILED;
    }
  }

  private async calculateConsistency(
    task: VerificationTask,
    submission: WorkerSubmission
  ): Promise<number> {
    // TODO: Implement consistency calculation based on worker's history
    return 0.8; // Placeholder
  }

  private calculateSubmissionAgreement(submissions: WorkerSubmission[]): number {
    const totalPairs = (submissions.length * (submissions.length - 1)) / 2;
    let agreementCount = 0;

    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        if (this.resultsMatch(submissions[i].result, submissions[j].result)) {
          agreementCount++;
        }
      }
    }

    return agreementCount / totalPairs;
  }

  private resultsMatch(result1: any, result2: any): boolean {
    return JSON.stringify(result1) === JSON.stringify(result2);
  }

  private normalizeTimeScore(timeSpent: number): number {
    // TODO: Implement time normalization based on task type
    return 0.75; // Placeholder
  }

  private calculateAverageProcessingTime(submissions: WorkerSubmission[]): number {
    return this.average(submissions.map(s => s.completedAt - s.startedAt));
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private async detectFraud(task: VerificationTask, submissions: WorkerSubmission[]): Promise<any> {
    // TODO: Implement fraud detection
    return {
      hasSuspiciousActivity: false,
      suspiciousActivities: [],
      riskLevel: 'LOW',
      workerBehaviorAnalysis: [],
      timestamp: new Date().toISOString(),
    };
  }
}
