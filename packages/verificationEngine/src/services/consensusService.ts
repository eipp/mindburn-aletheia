import { Logger } from '@mindburn/shared/logger';
import {
  WorkerSubmission,
  VerificationTask,
  VerificationResult,
  ConsensusStrategy,
  VerificationStatus,
  ConfidenceLevel,
  QualityMetrics,
  WorkerMetrics
} from '../types';
import { ConsensusError } from '../errors';

export class ConsensusService {
  private readonly logger: Logger;
  private readonly confidenceThresholds = {
    high: 0.8,
    medium: 0.6
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'Consensus' });
  }

  async calculateConsensus(
    task: VerificationTask,
    submissions: WorkerSubmission[],
    workerMetrics: Map<string, WorkerMetrics>
  ): Promise<VerificationResult> {
    try {
      if (submissions.length < task.requirements.minSubmissions) {
        return this.createResult(task.taskId, VerificationStatus.NEEDS_REVIEW, null);
      }

      let consensus: any;
      let confidenceLevel: ConfidenceLevel;

      switch (task.consensusStrategy) {
        case ConsensusStrategy.MAJORITY:
          ({ consensus, confidenceLevel } = this.calculateMajorityConsensus(submissions));
          break;
        
        case ConsensusStrategy.WEIGHTED:
          ({ consensus, confidenceLevel } = this.calculateWeightedConsensus(
            submissions,
            workerMetrics
          ));
          break;
        
        case ConsensusStrategy.UNANIMOUS:
          ({ consensus, confidenceLevel } = this.calculateUnanimousConsensus(submissions));
          break;
        
        default:
          throw new ConsensusError(`Unknown consensus strategy: ${task.consensusStrategy}`);
      }

      const qualityMetrics = this.calculateQualityMetrics(
        submissions,
        consensus,
        workerMetrics
      );

      return {
        taskId: task.taskId,
        status: this.determineStatus(confidenceLevel, task.requirements.qualityThreshold),
        consensus,
        confidenceLevel,
        workerMetrics: qualityMetrics,
        fraudDetection: {
          hasSuspiciousActivity: false,
          suspiciousActivities: [],
          riskLevel: 'LOW',
          workerBehaviorAnalysis: [],
          timestamp: new Date().toISOString()
        },
        processedAt: new Date().toISOString(),
        metadata: {
          submissionCount: submissions.length,
          strategy: task.consensusStrategy
        }
      };
    } catch (error) {
      this.logger.error('Consensus calculation failed', { error, taskId: task.taskId });
      throw new ConsensusError('Failed to calculate consensus', { cause: error });
    }
  }

  private calculateMajorityConsensus(
    submissions: WorkerSubmission[]
  ): { consensus: any; confidenceLevel: ConfidenceLevel } {
    const resultMap = new Map<string, number>();
    let maxCount = 0;
    let majorityResult: any;

    // Count occurrences of each unique result
    for (const submission of submissions) {
      const resultStr = JSON.stringify(submission.result);
      const count = (resultMap.get(resultStr) || 0) + 1;
      resultMap.set(resultStr, count);

      if (count > maxCount) {
        maxCount = count;
        majorityResult = submission.result;
      }
    }

    const confidence = maxCount / submissions.length;
    const confidenceLevel = this.determineConfidenceLevel(confidence);

    return {
      consensus: majorityResult,
      confidenceLevel
    };
  }

  private calculateWeightedConsensus(
    submissions: WorkerSubmission[],
    workerMetrics: Map<string, WorkerMetrics>
  ): { consensus: any; confidenceLevel: ConfidenceLevel } {
    const weightedResults = new Map<string, number>();
    let totalWeight = 0;

    // Calculate weighted scores for each result
    for (const submission of submissions) {
      const metrics = workerMetrics.get(submission.workerId);
      if (!metrics) continue;

      const weight = this.calculateWorkerWeight(metrics);
      const resultStr = JSON.stringify(submission.result);
      
      weightedResults.set(
        resultStr,
        (weightedResults.get(resultStr) || 0) + weight
      );
      totalWeight += weight;
    }

    // Find result with highest weighted score
    let maxWeight = 0;
    let consensusResult: any;

    for (const [resultStr, weight] of weightedResults.entries()) {
      if (weight > maxWeight) {
        maxWeight = weight;
        consensusResult = JSON.parse(resultStr);
      }
    }

    const confidence = maxWeight / totalWeight;
    const confidenceLevel = this.determineConfidenceLevel(confidence);

    return {
      consensus: consensusResult,
      confidenceLevel
    };
  }

  private calculateUnanimousConsensus(
    submissions: WorkerSubmission[]
  ): { consensus: any; confidenceLevel: ConfidenceLevel } {
    const firstResult = JSON.stringify(submissions[0].result);
    const isUnanimous = submissions.every(
      s => JSON.stringify(s.result) === firstResult
    );

    return {
      consensus: isUnanimous ? submissions[0].result : null,
      confidenceLevel: isUnanimous ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW
    };
  }

  private calculateQualityMetrics(
    submissions: WorkerSubmission[],
    consensus: any,
    workerMetrics: Map<string, WorkerMetrics>
  ): QualityMetrics[] {
    const consensusStr = JSON.stringify(consensus);
    
    return submissions.map(submission => {
      const metrics = workerMetrics.get(submission.workerId);
      const accuracy = JSON.stringify(submission.result) === consensusStr ? 1 : 0;
      
      return {
        workerId: submission.workerId,
        submissionId: submission.submissionId,
        accuracy,
        timeSpent: submission.completedAt - submission.startedAt,
        consistencyScore: metrics?.consistency || 0
      };
    });
  }

  private calculateWorkerWeight(metrics: WorkerMetrics): number {
    return (
      metrics.accuracy * 0.4 +
      metrics.consistency * 0.3 +
      metrics.reputationScore * 0.3
    );
  }

  private determineConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= this.confidenceThresholds.high) {
      return ConfidenceLevel.HIGH;
    }
    if (confidence >= this.confidenceThresholds.medium) {
      return ConfidenceLevel.MEDIUM;
    }
    return ConfidenceLevel.LOW;
  }

  private determineStatus(
    confidenceLevel: ConfidenceLevel,
    qualityThreshold: number
  ): VerificationStatus {
    if (confidenceLevel === ConfidenceLevel.HIGH && qualityThreshold >= 0.8) {
      return VerificationStatus.COMPLETED;
    }
    if (confidenceLevel === ConfidenceLevel.LOW || qualityThreshold < 0.6) {
      return VerificationStatus.NEEDS_REVIEW;
    }
    return VerificationStatus.COMPLETED;
  }

  private createResult(
    taskId: string,
    status: VerificationStatus,
    consensus: any
  ): VerificationResult {
    return {
      taskId,
      status,
      consensus,
      confidenceLevel: ConfidenceLevel.LOW,
      workerMetrics: [],
      fraudDetection: {
        hasSuspiciousActivity: false,
        suspiciousActivities: [],
        riskLevel: 'LOW',
        workerBehaviorAnalysis: [],
        timestamp: new Date().toISOString()
      },
      processedAt: new Date().toISOString(),
      metadata: {
        insufficientSubmissions: true
      }
    };
  }
} 