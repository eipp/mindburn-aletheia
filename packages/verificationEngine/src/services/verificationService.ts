import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  WorkerSubmission,
  VerificationResult,
  VerificationStatus,
  WorkerMetrics
} from '../types';
import { VerificationError } from '../errors';
import { QualityControlService } from './qualityControlService';
import { FraudDetectionService } from './fraudDetectionService';
import { ConsensusService } from './consensusService';

export class VerificationService {
  private readonly logger: Logger;
  private readonly qualityControl: QualityControlService;
  private readonly fraudDetection: FraudDetectionService;
  private readonly consensus: ConsensusService;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'Verification' });
    this.qualityControl = new QualityControlService(logger);
    this.fraudDetection = new FraudDetectionService(logger);
    this.consensus = new ConsensusService(logger);
  }

  async verifyTask(
    task: VerificationTask,
    submissions: WorkerSubmission[]
  ): Promise<VerificationResult> {
    try {
      this.logger.info('Starting task verification', {
        taskId: task.taskId,
        submissionCount: submissions.length
      });

      // Validate submissions
      this.validateSubmissions(task, submissions);

      // Get worker metrics for all involved workers
      const workerMetrics = await this.getWorkerMetrics(
        submissions.map(s => s.workerId)
      );

      // Run fraud detection
      const fraudDetection = await this.fraudDetection.analyzeSubmissions(submissions);
      
      if (fraudDetection.riskLevel === 'HIGH') {
        return this.createFailedResult(
          task.taskId,
          'High risk of fraudulent activity detected',
          fraudDetection
        );
      }

      // Calculate consensus
      const result = await this.consensus.calculateConsensus(
        task,
        submissions,
        workerMetrics
      );

      // Update worker metrics based on verification result
      await this.updateWorkerMetrics(result);

      this.logger.info('Task verification completed', {
        taskId: task.taskId,
        status: result.status,
        confidenceLevel: result.confidenceLevel
      });

      return {
        ...result,
        fraudDetection
      };
    } catch (error) {
      this.logger.error('Task verification failed', {
        error,
        taskId: task.taskId
      });
      throw new VerificationError('Failed to verify task', { cause: error });
    }
  }

  private validateSubmissions(
    task: VerificationTask,
    submissions: WorkerSubmission[]
  ): void {
    // Check minimum submissions requirement
    if (submissions.length < task.requirements.minSubmissions) {
      throw new VerificationError(
        `Insufficient submissions: ${submissions.length}/${task.requirements.minSubmissions}`
      );
    }

    // Check for duplicate worker submissions
    const workerSubmissions = new Set<string>();
    for (const submission of submissions) {
      if (workerSubmissions.has(submission.workerId)) {
        throw new VerificationError(
          `Duplicate submission from worker: ${submission.workerId}`
        );
      }
      workerSubmissions.add(submission.workerId);
    }

    // Validate time limits if specified
    if (task.requirements.timeLimit) {
      const now = Date.now();
      for (const submission of submissions) {
        const timeSpent = submission.completedAt - submission.startedAt;
        if (timeSpent > task.requirements.timeLimit * 1000) {
          throw new VerificationError(
            `Submission exceeded time limit: ${submission.submissionId}`
          );
        }
      }
    }

    // Validate worker levels if specified
    if (task.requirements.workerLevel) {
      // TODO: Implement worker level validation once worker profile service is ready
    }
  }

  private async getWorkerMetrics(
    workerIds: string[]
  ): Promise<Map<string, WorkerMetrics>> {
    const metricsMap = new Map<string, WorkerMetrics>();
    
    for (const workerId of workerIds) {
      try {
        const metrics = await this.qualityControl.getWorkerScore(workerId);
        metricsMap.set(workerId, {
          workerId,
          accuracy: metrics.accuracy,
          consistency: metrics.consistency,
          speedScore: metrics.speedScore,
          reputationScore: metrics.overall,
          averageTaskTime: 0, // TODO: Implement task time tracking
          currentTaskType: '' // TODO: Implement task type tracking
        });
      } catch (error) {
        this.logger.warn('Failed to get worker metrics', {
          error,
          workerId
        });
        // Use default metrics if unable to fetch
        metricsMap.set(workerId, {
          workerId,
          accuracy: 0.5,
          consistency: 0.5,
          speedScore: 0.5,
          reputationScore: 0.5,
          averageTaskTime: 0,
          currentTaskType: ''
        });
      }
    }

    return metricsMap;
  }

  private async updateWorkerMetrics(result: VerificationResult): Promise<void> {
    for (const metrics of result.workerMetrics) {
      try {
        await this.qualityControl.updateWorkerScore(
          metrics.workerId,
          {
            accuracy: metrics.accuracy,
            consistency: metrics.consistencyScore,
            speedScore: this.calculateSpeedScore(metrics.timeSpent),
            accuracyTrend: 0, // Will be calculated by quality control service
            overall: 0 // Will be calculated by quality control service
          }
        );
      } catch (error) {
        this.logger.error('Failed to update worker metrics', {
          error,
          workerId: metrics.workerId
        });
      }
    }
  }

  private calculateSpeedScore(timeSpent: number): number {
    // TODO: Implement proper speed score calculation based on task type
    // This is a placeholder implementation
    const optimalTime = 60000; // 1 minute
    const ratio = timeSpent / optimalTime;
    if (ratio > 2) return 0.3;
    if (ratio < 0.5) return 0.3;
    return 1 - Math.abs(1 - ratio) * 0.7;
  }

  private createFailedResult(
    taskId: string,
    reason: string,
    fraudDetection: VerificationResult['fraudDetection']
  ): VerificationResult {
    return {
      taskId,
      status: VerificationStatus.FAILED,
      consensus: null,
      confidenceLevel: 'LOW',
      workerMetrics: [],
      fraudDetection,
      processedAt: new Date().toISOString(),
      metadata: {
        failureReason: reason
      }
    };
  }
} 