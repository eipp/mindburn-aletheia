import { Logger } from '@mindburn/shared/logger';
import { 
  WorkerMetrics,
  QualityScore,
  WorkerLevel,
  PerformanceHistory,
  QualityThresholds
} from '../types';
import { QualityControlError } from '../errors';

export class QualityControlService {
  private readonly logger: Logger;
  private readonly thresholds: QualityThresholds = {
    accuracy: {
      low: 0.6,
      medium: 0.8,
      high: 0.95
    },
    consistency: {
      low: 0.5,
      medium: 0.7,
      high: 0.9
    },
    speedScore: {
      slow: 2.0, // 2x average time
      medium: 1.2, // 1.2x average time
      fast: 0.8 // 0.8x average time
    }
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'QualityControl' });
  }

  async getWorkerScore(workerId: string): Promise<number> {
    try {
      const metrics = await this.getWorkerMetrics(workerId);
      return this.calculateOverallScore(metrics);
    } catch (error) {
      this.logger.error('Failed to get worker score', { workerId, error });
      throw new QualityControlError('Failed to get worker score', { cause: error });
    }
  }

  async calculateConsistencyScore(
    workerId: string,
    currentAccuracy: number
  ): Promise<number> {
    try {
      const history = await this.getWorkerHistory(workerId);
      const recentAccuracies = history.recentTasks
        .slice(-10) // Look at last 10 tasks
        .map(task => task.accuracy);

      // Calculate standard deviation of accuracies
      const mean = recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length;
      const variance = recentAccuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / recentAccuracies.length;
      const stdDev = Math.sqrt(variance);

      // Higher consistency = lower standard deviation
      const consistencyScore = Math.max(0, 1 - stdDev);

      // Weight recent performance more heavily
      const weightedScore = (consistencyScore * 0.7) + (currentAccuracy * 0.3);

      return weightedScore;
    } catch (error) {
      this.logger.error('Failed to calculate consistency score', { workerId, error });
      throw new QualityControlError('Failed to calculate consistency score', { cause: error });
    }
  }

  async evaluateWorkerLevel(workerId: string): Promise<WorkerLevel> {
    try {
      const metrics = await this.getWorkerMetrics(workerId);
      const history = await this.getWorkerHistory(workerId);
      
      const qualityScore = await this.calculateQualityScore(metrics, history);
      
      // Determine level based on quality score and task count
      if (
        qualityScore.overall >= this.thresholds.accuracy.high &&
        history.totalTasks >= 100 &&
        qualityScore.consistency >= this.thresholds.consistency.high
      ) {
        return WorkerLevel.EXPERT;
      } else if (
        qualityScore.overall >= this.thresholds.accuracy.medium &&
        history.totalTasks >= 50 &&
        qualityScore.consistency >= this.thresholds.consistency.medium
      ) {
        return WorkerLevel.ADVANCED;
      } else if (
        qualityScore.overall >= this.thresholds.accuracy.low &&
        history.totalTasks >= 20
      ) {
        return WorkerLevel.INTERMEDIATE;
      }
      
      return WorkerLevel.BEGINNER;
    } catch (error) {
      this.logger.error('Failed to evaluate worker level', { workerId, error });
      throw new QualityControlError('Failed to evaluate worker level', { cause: error });
    }
  }

  private async calculateQualityScore(
    metrics: WorkerMetrics,
    history: PerformanceHistory
  ): Promise<QualityScore> {
    // Calculate accuracy trend
    const accuracyTrend = this.calculateTrend(
      history.recentTasks.map(task => task.accuracy)
    );

    // Calculate speed score
    const speedScore = this.calculateSpeedScore(
      metrics.averageTaskTime,
      history.taskTypeAverages[metrics.currentTaskType]
    );

    // Calculate consistency
    const consistency = this.calculateConsistency(history.recentTasks);

    // Calculate overall score with weights
    const overall = (
      (metrics.accuracy * 0.4) +
      (consistency * 0.3) +
      (speedScore * 0.2) +
      (accuracyTrend * 0.1)
    );

    return {
      overall,
      accuracy: metrics.accuracy,
      consistency,
      speedScore,
      accuracyTrend
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression
    const n = values.length;
    const xSum = values.reduce((sum, _, i) => sum + i, 0);
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + (val * i), 0);
    const x2Sum = values.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    
    // Normalize slope to [-1, 1] range
    return Math.max(-1, Math.min(1, slope * 10));
  }

  private calculateSpeedScore(
    workerTime: number,
    averageTime: number
  ): number {
    const ratio = workerTime / averageTime;
    
    if (ratio <= this.thresholds.speedScore.fast) return 1;
    if (ratio <= this.thresholds.speedScore.medium) return 0.8;
    if (ratio <= this.thresholds.speedScore.slow) return 0.5;
    return 0.2;
  }

  private calculateConsistency(tasks: Array<{ accuracy: number }>): number {
    if (tasks.length < 2) return 1;

    const accuracies = tasks.map(t => t.accuracy);
    const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    
    // Convert variance to consistency score (0-1)
    return Math.max(0, 1 - Math.sqrt(variance));
  }

  private calculateOverallScore(metrics: WorkerMetrics): number {
    return (
      (metrics.accuracy * 0.4) +
      (metrics.consistency * 0.3) +
      (metrics.speedScore * 0.2) +
      (metrics.reputationScore * 0.1)
    );
  }

  private async getWorkerMetrics(workerId: string): Promise<WorkerMetrics> {
    // TODO: Implement metrics retrieval from database
    // This is a placeholder
    return {
      workerId,
      accuracy: 0.9,
      consistency: 0.85,
      speedScore: 0.8,
      reputationScore: 0.9,
      averageTaskTime: 300,
      currentTaskType: 'verification'
    };
  }

  private async getWorkerHistory(workerId: string): Promise<PerformanceHistory> {
    // TODO: Implement history retrieval from database
    // This is a placeholder
    return {
      workerId,
      totalTasks: 100,
      recentTasks: Array(10).fill({
        taskId: 'task-1',
        accuracy: 0.9,
        timeSpent: 300
      }),
      taskTypeAverages: {
        verification: 300
      }
    };
  }
} 