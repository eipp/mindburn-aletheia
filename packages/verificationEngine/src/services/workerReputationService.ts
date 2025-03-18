import { Logger } from '@mindburn/shared/logger';
import {
  WorkerProfile,
  TaskType,
  WorkerLevel,
  QualityMetrics,
  VerificationResult,
  WorkerSubmission
} from '../types';

interface SkillAssessment {
  skillLevel: number;
  taskCount: number;
  averageAccuracy: number;
  lastUpdated: string;
}

interface ReputationFactors {
  taskCompletion: number;
  accuracy: number;
  consistency: number;
  speed: number;
  complexity: number;
}

export class WorkerReputationService {
  private readonly logger: Logger;
  private readonly levelThresholds = {
    BEGINNER: 0,
    INTERMEDIATE: 100,
    ADVANCED: 250,
    EXPERT: 500
  };

  private readonly skillLevelThresholds = {
    NOVICE: 0,
    PROFICIENT: 25,
    SKILLED: 50,
    EXPERT: 75,
    MASTER: 90
  };

  private readonly taskComplexityWeights: Record<TaskType, number> = {
    TEXT_CLASSIFICATION: 1.0,
    IMAGE_CLASSIFICATION: 1.2,
    SENTIMENT_ANALYSIS: 1.1,
    ENTITY_RECOGNITION: 1.4,
    DATA_VALIDATION: 1.0,
    CONTENT_MODERATION: 1.3,
    TRANSLATION_VERIFICATION: 1.5,
    AUDIO_TRANSCRIPTION: 1.3,
    VIDEO_ANNOTATION: 1.4,
    DOCUMENT_VERIFICATION: 1.2
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'WorkerReputation' });
  }

  async updateWorkerReputation(
    worker: WorkerProfile,
    verificationResult: VerificationResult,
    submission: WorkerSubmission,
    taskType: TaskType
  ): Promise<WorkerProfile> {
    try {
      // Get worker metrics from verification result
      const metrics = verificationResult.workerMetrics.find(
        m => m.workerId === worker.workerId
      );

      if (!metrics) {
        throw new Error(`No metrics found for worker ${worker.workerId}`);
      }

      // Update skill assessment
      const updatedSkills = this.updateSkillAssessment(
        worker,
        taskType,
        metrics
      );

      // Calculate reputation factors
      const factors = this.calculateReputationFactors(
        worker,
        metrics,
        taskType
      );

      // Calculate new reputation score
      const newReputationScore = this.calculateReputationScore(factors);

      // Update worker level if needed
      const newLevel = this.determineWorkerLevel(newReputationScore);

      // Update performance metrics
      const updatedPerformanceMetrics = {
        ...worker.performanceMetrics,
        [taskType]: {
          accuracy: metrics.accuracy,
          speed: this.calculateSpeedScore(metrics.timeSpent, taskType),
          consistency: metrics.consistencyScore
        }
      };

      // Create updated worker profile
      const updatedWorker: WorkerProfile = {
        ...worker,
        level: newLevel,
        skillLevels: updatedSkills,
        reputationScore: newReputationScore,
        performanceMetrics: updatedPerformanceMetrics,
        metadata: {
          ...worker.metadata,
          lastUpdate: new Date().toISOString(),
          taskHistory: [
            ...(worker.metadata?.taskHistory || []),
            {
              taskId: verificationResult.taskId,
              type: taskType,
              accuracy: metrics.accuracy,
              timestamp: new Date().toISOString()
            }
          ].slice(-100) // Keep last 100 tasks
        }
      };

      this.logger.info('Worker reputation updated', {
        workerId: worker.workerId,
        oldScore: worker.reputationScore,
        newScore: newReputationScore,
        taskType
      });

      return updatedWorker;

    } catch (error) {
      this.logger.error('Failed to update worker reputation', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  private updateSkillAssessment(
    worker: WorkerProfile,
    taskType: TaskType,
    metrics: QualityMetrics
  ): Record<TaskType, number> {
    const currentSkills = { ...worker.skillLevels };
    const currentAssessment = currentSkills[taskType] || 0;

    // Calculate new skill level
    const performanceScore = 
      (metrics.accuracy * 0.6) +
      (metrics.consistencyScore * 0.3) +
      (this.calculateSpeedScore(metrics.timeSpent, taskType) * 0.1);

    // Apply progressive learning rate
    const learningRate = this.calculateLearningRate(currentAssessment);
    const skillDelta = (performanceScore - currentAssessment) * learningRate;

    // Update skill level with bounds checking
    currentSkills[taskType] = Math.max(
      0,
      Math.min(100, currentAssessment + skillDelta)
    );

    return currentSkills;
  }

  private calculateLearningRate(currentSkill: number): number {
    // Learning rate decreases as skill level increases
    return Math.max(0.1, 1 - (currentSkill / 100) * 0.8);
  }

  private calculateReputationFactors(
    worker: WorkerProfile,
    metrics: QualityMetrics,
    taskType: TaskType
  ): ReputationFactors {
    return {
      taskCompletion: 1.0, // Base factor for completing the task
      accuracy: metrics.accuracy,
      consistency: metrics.consistencyScore,
      speed: this.calculateSpeedScore(metrics.timeSpent, taskType),
      complexity: this.taskComplexityWeights[taskType] || 1.0
    };
  }

  private calculateReputationScore(factors: ReputationFactors): number {
    const weightedScore = 
      (factors.taskCompletion * 0.1) +
      (factors.accuracy * 0.3) +
      (factors.consistency * 0.2) +
      (factors.speed * 0.2) +
      (factors.complexity * 0.2);

    // Normalize to 0-100 range
    return Math.min(100, Math.max(0, weightedScore * 100));
  }

  private calculateSpeedScore(timeSpent: number, taskType: TaskType): number {
    // TODO: Implement proper speed scoring based on task type
    return 0.8; // Placeholder
  }

  private determineWorkerLevel(reputationScore: number): WorkerLevel {
    if (reputationScore >= this.levelThresholds.EXPERT) {
      return WorkerLevel.EXPERT;
    } else if (reputationScore >= this.levelThresholds.ADVANCED) {
      return WorkerLevel.ADVANCED;
    } else if (reputationScore >= this.levelThresholds.INTERMEDIATE) {
      return WorkerLevel.INTERMEDIATE;
    } else {
      return WorkerLevel.BEGINNER;
    }
  }

  getWorkerSkillLevel(worker: WorkerProfile, taskType: TaskType): string {
    const skillScore = worker.skillLevels[taskType] || 0;

    if (skillScore >= this.skillLevelThresholds.MASTER) {
      return 'MASTER';
    } else if (skillScore >= this.skillLevelThresholds.EXPERT) {
      return 'EXPERT';
    } else if (skillScore >= this.skillLevelThresholds.SKILLED) {
      return 'SKILLED';
    } else if (skillScore >= this.skillLevelThresholds.PROFICIENT) {
      return 'PROFICIENT';
    } else {
      return 'NOVICE';
    }
  }

  async assessWorkerForTask(
    worker: WorkerProfile,
    taskType: TaskType,
    requiredSkillLevel: number
  ): Promise<boolean> {
    const workerSkill = worker.skillLevels[taskType] || 0;
    const skillGap = requiredSkillLevel - workerSkill;

    // Allow workers to attempt tasks slightly above their skill level
    const skillBuffer = 10; // Allow tasks up to 10 points above current skill
    
    return skillGap <= skillBuffer;
  }

  getWorkerStats(worker: WorkerProfile): {
    totalTasks: number;
    averageAccuracy: number;
    skillDistribution: Record<TaskType, number>;
    recentPerformance: Array<{
      taskId: string;
      type: TaskType;
      accuracy: number;
      timestamp: string;
    }>;
  } {
    const taskHistory = worker.metadata?.taskHistory || [];
    
    return {
      totalTasks: taskHistory.length,
      averageAccuracy: this.calculateAverageAccuracy(taskHistory),
      skillDistribution: worker.skillLevels,
      recentPerformance: taskHistory.slice(-10) // Last 10 tasks
    };
  }

  private calculateAverageAccuracy(
    taskHistory: Array<{
      accuracy: number;
    }>
  ): number {
    if (taskHistory.length === 0) return 0;
    return taskHistory.reduce((sum, task) => sum + task.accuracy, 0) / taskHistory.length;
  }
} 