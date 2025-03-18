import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  WorkerProfile,
  WorkerMatch,
  WorkerStatus,
  TaskType,
  MatchingStrategy,
  WorkerLevel,
  TaskPriority
} from '../types';
import { MatchingError } from '../errors';

interface MatchWeights {
  skill: number;
  reputation: number;
  availability: number;
  taskHistory: number;
  performance: number;
  loadBalance: number;
}

export class WorkerMatcherService {
  private readonly logger: Logger;
  private readonly defaultWeights: MatchWeights = {
    skill: 0.3,
    reputation: 0.2,
    availability: 0.15,
    taskHistory: 0.15,
    performance: 0.15,
    loadBalance: 0.05
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'WorkerMatcher' });
  }

  async findBestMatches(
    task: VerificationTask,
    availableWorkers: WorkerProfile[],
    strategy: MatchingStrategy = MatchingStrategy.BALANCED,
    count: number = task.requirements.minSubmissions
  ): Promise<WorkerMatch[]> {
    try {
      // Filter eligible workers
      const eligibleWorkers = this.filterEligibleWorkers(task, availableWorkers);
      
      if (eligibleWorkers.length < count) {
        throw new MatchingError(
          `Insufficient eligible workers. Need ${count}, found ${eligibleWorkers.length}`
        );
      }

      // Adjust weights based on strategy
      const weights = this.getStrategyWeights(strategy);

      // Calculate match scores
      const matches = await Promise.all(
        eligibleWorkers.map(async worker => ({
          worker,
          score: await this.calculateMatchScore(worker, task, weights)
        }))
      );

      // Sort by score and return top matches
      return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, count);

    } catch (error) {
      this.logger.error('Failed to find worker matches', {
        error,
        taskId: task.taskId,
        strategy
      });
      throw error;
    }
  }

  private filterEligibleWorkers(
    task: VerificationTask,
    workers: WorkerProfile[]
  ): WorkerProfile[] {
    return workers.filter(worker => 
      // Basic eligibility
      worker.status === WorkerStatus.AVAILABLE &&
      worker.skills.includes(task.type as TaskType) &&
      
      // Skill level check
      this.meetsSkillRequirement(worker, task) &&
      
      // Reputation threshold
      worker.reputationScore >= this.getMinReputationScore(task) &&
      
      // Performance check
      this.meetsPerformanceRequirement(worker, task)
    );
  }

  private async calculateMatchScore(
    worker: WorkerProfile,
    task: VerificationTask,
    weights: MatchWeights
  ): Promise<number> {
    const scores = {
      skill: this.calculateSkillScore(worker, task),
      reputation: this.calculateReputationScore(worker),
      availability: await this.calculateAvailabilityScore(worker),
      taskHistory: await this.calculateTaskHistoryScore(worker, task),
      performance: this.calculatePerformanceScore(worker, task),
      loadBalance: await this.calculateLoadBalanceScore(worker)
    };

    return Object.entries(scores).reduce(
      (total, [key, score]) => total + score * weights[key as keyof MatchWeights],
      0
    );
  }

  private calculateSkillScore(
    worker: WorkerProfile,
    task: VerificationTask
  ): number {
    const taskType = task.type as TaskType;
    const skillLevel = worker.skillLevels[taskType] || 0;
    const maxSkillLevel = 10; // Assuming 10 is max skill level

    return skillLevel / maxSkillLevel;
  }

  private calculateReputationScore(worker: WorkerProfile): number {
    return worker.reputationScore;
  }

  private async calculateAvailabilityScore(
    worker: WorkerProfile
  ): Promise<number> {
    // TODO: Implement availability tracking
    return worker.status === WorkerStatus.AVAILABLE ? 1 : 0;
  }

  private async calculateTaskHistoryScore(
    worker: WorkerProfile,
    task: VerificationTask
  ): Promise<number> {
    const taskType = task.type as TaskType;
    const metrics = worker.performanceMetrics[taskType];
    
    if (!metrics) return 0.5; // Neutral score for new task types

    return (
      metrics.accuracy * 0.4 +
      metrics.speed * 0.3 +
      metrics.consistency * 0.3
    );
  }

  private calculatePerformanceScore(
    worker: WorkerProfile,
    task: VerificationTask
  ): number {
    const taskType = task.type as TaskType;
    const metrics = worker.performanceMetrics[taskType];
    
    if (!metrics) return 0.5;

    // Weight recent performance more heavily
    return (
      metrics.accuracy * 0.5 +
      metrics.speed * 0.25 +
      metrics.consistency * 0.25
    );
  }

  private async calculateLoadBalanceScore(
    worker: WorkerProfile
  ): Promise<number> {
    // TODO: Implement load balancing based on active tasks
    return 1.0;
  }

  private getStrategyWeights(strategy: MatchingStrategy): MatchWeights {
    switch (strategy) {
      case MatchingStrategy.SKILL_FOCUSED:
        return {
          ...this.defaultWeights,
          skill: 0.5,
          performance: 0.2,
          reputation: 0.15,
          availability: 0.1,
          taskHistory: 0.03,
          loadBalance: 0.02
        };
      
      case MatchingStrategy.REPUTATION_FOCUSED:
        return {
          ...this.defaultWeights,
          reputation: 0.5,
          skill: 0.2,
          performance: 0.15,
          availability: 0.1,
          taskHistory: 0.03,
          loadBalance: 0.02
        };
      
      case MatchingStrategy.PERFORMANCE_FOCUSED:
        return {
          ...this.defaultWeights,
          performance: 0.4,
          skill: 0.25,
          reputation: 0.15,
          availability: 0.15,
          taskHistory: 0.03,
          loadBalance: 0.02
        };
      
      default:
        return this.defaultWeights;
    }
  }

  private meetsSkillRequirement(
    worker: WorkerProfile,
    task: VerificationTask
  ): boolean {
    const taskType = task.type as TaskType;
    const requiredLevel = this.getRequiredSkillLevel(task);
    return (worker.skillLevels[taskType] || 0) >= requiredLevel;
  }

  private getRequiredSkillLevel(task: VerificationTask): number {
    const levelRequirements = {
      [WorkerLevel.BEGINNER]: 1,
      [WorkerLevel.INTERMEDIATE]: 4,
      [WorkerLevel.ADVANCED]: 7,
      [WorkerLevel.EXPERT]: 9
    };

    return levelRequirements[task.requirements.workerLevel || WorkerLevel.BEGINNER];
  }

  private getMinReputationScore(task: VerificationTask): number {
    const baseScore = 0.7; // Base reputation requirement
    
    // Adjust based on task priority
    const priorityMultipliers = {
      [TaskPriority.LOW]: 0.8,
      [TaskPriority.MEDIUM]: 1.0,
      [TaskPriority.HIGH]: 1.2
    };

    return baseScore * (priorityMultipliers[task.priority] || 1.0);
  }

  private meetsPerformanceRequirement(
    worker: WorkerProfile,
    task: VerificationTask
  ): boolean {
    const metrics = worker.performanceMetrics[task.type as TaskType];
    if (!metrics) return true; // Allow new workers

    const minAccuracy = this.getMinAccuracy(task);
    const minConsistency = this.getMinConsistency(task);

    return metrics.accuracy >= minAccuracy && 
           metrics.consistency >= minConsistency;
  }

  private getMinAccuracy(task: VerificationTask): number {
    const baseAccuracy = 0.8;
    
    const priorityMultipliers = {
      [TaskPriority.LOW]: 0.9,
      [TaskPriority.MEDIUM]: 1.0,
      [TaskPriority.HIGH]: 1.1
    };

    return baseAccuracy * (priorityMultipliers[task.priority] || 1.0);
  }

  private getMinConsistency(task: VerificationTask): number {
    const baseConsistency = 0.75;
    
    const priorityMultipliers = {
      [TaskPriority.LOW]: 0.9,
      [TaskPriority.MEDIUM]: 1.0,
      [TaskPriority.HIGH]: 1.1
    };

    return baseConsistency * (priorityMultipliers[task.priority] || 1.0);
  }
} 