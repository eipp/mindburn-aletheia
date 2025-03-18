import { Logger } from '@mindburn/shared/logger';
import {
  TaskType,
  WorkerProfile,
  WorkerLevel,
  NotificationService,
  SkillAssessmentResult,
  AssessmentTask
} from '../types';
import { AssessmentTaskRepository } from './assessmentTaskRepository';

export class WorkerSkillAssessmentService {
  private readonly logger: Logger;
  private readonly notificationService: NotificationService;
  private readonly taskRepository: AssessmentTaskRepository;

  private readonly skillLevelThresholds = {
    BEGINNER: 0,
    INTERMEDIATE: 60,
    ADVANCED: 80,
    EXPERT: 90
  };

  private readonly taskTypeWeights = {
    TEXT_CLASSIFICATION: 1.0,
    IMAGE_CLASSIFICATION: 1.2,
    SENTIMENT_ANALYSIS: 1.1,
    ENTITY_RECOGNITION: 1.3,
    CONTENT_MODERATION: 1.4,
    DATA_VALIDATION: 1.0,
    TRANSLATION_VERIFICATION: 1.5,
    AUDIO_TRANSCRIPTION: 1.4,
    VIDEO_ANNOTATION: 1.6,
    DOCUMENT_VERIFICATION: 1.3
  };

  constructor(
    logger: Logger,
    notificationService: NotificationService,
    taskRepository: AssessmentTaskRepository
  ) {
    this.logger = logger.child({ service: 'WorkerSkillAssessment' });
    this.notificationService = notificationService;
    this.taskRepository = taskRepository;
  }

  async assessSkill(
    worker: WorkerProfile,
    taskType: TaskType
  ): Promise<SkillAssessmentResult> {
    try {
      // Get assessment tasks for the skill level
      const tasks = await this.taskRepository.getTasksForAssessment(
        taskType,
        worker.level,
        3 // Get 3 tasks for assessment
      );

      if (!tasks.length) {
        throw new Error(`No assessment tasks available for ${taskType}`);
      }

      // Track assessment metrics
      let totalAccuracy = 0;
      let totalSpeed = 0;
      let totalConsistency = 0;
      const results: any[] = [];

      // Process each assessment task
      for (const task of tasks) {
        const result = await this.processAssessmentTask(worker, task);
        results.push(result);

        totalAccuracy += result.accuracy;
        totalSpeed += result.speed;
        totalConsistency += result.consistency;
      }

      // Calculate final scores
      const assessmentResult: SkillAssessmentResult = {
        taskType,
        score: this.calculateWeightedScore(
          totalAccuracy / tasks.length,
          totalSpeed / tasks.length,
          totalConsistency / tasks.length,
          taskType
        ),
        details: {
          accuracy: totalAccuracy / tasks.length,
          speed: totalSpeed / tasks.length,
          consistency: totalConsistency / tasks.length
        },
        timestamp: new Date().toISOString()
      };

      this.logger.info('Skill assessment completed', {
        workerId: worker.workerId,
        taskType,
        score: assessmentResult.score
      });

      return assessmentResult;

    } catch (error) {
      this.logger.error('Skill assessment failed', {
        error,
        workerId: worker.workerId,
        taskType
      });
      throw error;
    }
  }

  async assessAllSkills(
    worker: WorkerProfile
  ): Promise<Record<TaskType, SkillAssessmentResult>> {
    const results: Record<TaskType, SkillAssessmentResult> = {} as Record<TaskType, SkillAssessmentResult>;

    for (const taskType of Object.values(TaskType)) {
      results[taskType] = await this.assessSkill(worker, taskType);
    }

    return results;
  }

  determineWorkerLevel(
    assessmentResults: Record<TaskType, SkillAssessmentResult>
  ): WorkerLevel {
    const scores = Object.values(assessmentResults).map(r => r.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (averageScore >= this.skillLevelThresholds.EXPERT) {
      return WorkerLevel.EXPERT;
    } else if (averageScore >= this.skillLevelThresholds.ADVANCED) {
      return WorkerLevel.ADVANCED;
    } else if (averageScore >= this.skillLevelThresholds.INTERMEDIATE) {
      return WorkerLevel.INTERMEDIATE;
    } else {
      return WorkerLevel.BEGINNER;
    }
  }

  async updateWorkerSkills(
    worker: WorkerProfile,
    assessmentResults: Record<TaskType, SkillAssessmentResult>
  ): Promise<WorkerProfile> {
    try {
      const skillLevels: Record<TaskType, number> = {};
      const qualifiedSkills: TaskType[] = [];

      // Update skill levels and determine qualified skills
      Object.entries(assessmentResults).forEach(([taskType, result]) => {
        skillLevels[taskType as TaskType] = result.score;
        if (result.score >= this.skillLevelThresholds.BEGINNER) {
          qualifiedSkills.push(taskType as TaskType);
        }
      });

      // Determine new worker level
      const newLevel = this.determineWorkerLevel(assessmentResults);

      // Update worker profile
      const updatedWorker = {
        ...worker,
        level: newLevel,
        skills: qualifiedSkills,
        skillLevels,
        metadata: {
          ...worker.metadata,
          lastSkillAssessment: {
            timestamp: new Date().toISOString(),
            results: assessmentResults
          }
        }
      };

      this.logger.info('Worker skills updated', {
        workerId: worker.workerId,
        newLevel,
        qualifiedSkills
      });

      // Notify worker of skill updates
      await this.notificationService.notifyWorker(
        worker.workerId,
        'STATUS_CHANGE',
        {
          type: 'SKILL_UPDATE',
          newLevel,
          qualifiedSkills
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Failed to update worker skills', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  private async processAssessmentTask(
    worker: WorkerProfile,
    task: AssessmentTask
  ): Promise<{
    accuracy: number;
    speed: number;
    consistency: number;
  }> {
    try {
      const startTime = Date.now();

      // TODO: Implement actual task processing logic
      // This is a placeholder implementation
      const submission = await this.simulateWorkerSubmission(task);
      
      const endTime = Date.now();
      const timeSpent = (endTime - startTime) / 1000; // Convert to seconds

      // Calculate metrics
      const accuracy = this.calculateAccuracy(task, submission);
      const speed = this.calculateSpeedScore(timeSpent, task.timeLimit);
      const consistency = this.calculateConsistencyScore(worker, task, submission);

      return {
        accuracy,
        speed,
        consistency
      };

    } catch (error) {
      this.logger.error('Failed to process assessment task', {
        error,
        workerId: worker.workerId,
        taskType: task.taskType
      });
      throw error;
    }
  }

  private calculateWeightedScore(
    accuracy: number,
    speed: number,
    consistency: number,
    taskType: TaskType
  ): number {
    const baseScore = (
      accuracy * 0.6 +
      speed * 0.2 +
      consistency * 0.2
    );

    return Math.min(
      100,
      baseScore * (this.taskTypeWeights[taskType] || 1.0)
    );
  }

  private async simulateWorkerSubmission(task: AssessmentTask): Promise<any> {
    // TODO: Replace with actual worker submission processing
    return task.expectedResult;
  }

  private calculateAccuracy(task: AssessmentTask, submission: any): number {
    // TODO: Implement proper accuracy calculation based on task type
    return 100; // Placeholder
  }

  private calculateSpeedScore(timeSpent: number, timeLimit: number): number {
    const speedRatio = timeSpent / timeLimit;
    if (speedRatio <= 0.5) return 100; // Excellent speed
    if (speedRatio <= 0.75) return 90; // Very good speed
    if (speedRatio <= 1) return 80; // Good speed
    if (speedRatio <= 1.25) return 70; // Acceptable speed
    if (speedRatio <= 1.5) return 60; // Slow
    return 50; // Very slow
  }

  private calculateConsistencyScore(
    worker: WorkerProfile,
    task: AssessmentTask,
    submission: any
  ): number {
    // TODO: Implement consistency calculation based on historical performance
    return 80; // Placeholder
  }
} 