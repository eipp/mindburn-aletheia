import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  WorkerProfile,
  TaskAssignment,
  TaskDistributionStrategy,
  MatchingStrategy,
  TaskPriority,
  WorkerStatus,
  AssignmentResult
} from '../types';
import { WorkerMatcherService } from './workerMatcherService';
import { AuctionService } from './auctionService';
import { NotificationService } from './notificationService';
import { DistributionError, ValidationError } from '../errors';

export class TaskDistributionService {
  private readonly logger: Logger;
  private readonly workerMatcher: WorkerMatcherService;
  private readonly auctionService: AuctionService;
  private readonly notificationService: NotificationService;

  private readonly assignmentTimeouts = {
    [TaskPriority.HIGH]: 5 * 60 * 1000, // 5 minutes
    [TaskPriority.MEDIUM]: 15 * 60 * 1000, // 15 minutes
    [TaskPriority.LOW]: 30 * 60 * 1000 // 30 minutes
  };

  constructor(
    logger: Logger,
    workerMatcher: WorkerMatcherService,
    auctionService: AuctionService,
    notificationService: NotificationService
  ) {
    this.logger = logger.child({ service: 'TaskDistribution' });
    this.workerMatcher = workerMatcher;
    this.auctionService = auctionService;
    this.notificationService = notificationService;
  }

  async distributeTask(
    task: VerificationTask,
    availableWorkers: WorkerProfile[],
    strategy: TaskDistributionStrategy = TaskDistributionStrategy.TARGETED
  ): Promise<AssignmentResult> {
    try {
      this.validateDistributionRequirements(task, availableWorkers);

      let assignments: TaskAssignment[];
      switch (strategy) {
        case TaskDistributionStrategy.BROADCAST:
          assignments = await this.broadcastTask(task, availableWorkers);
          break;
        
        case TaskDistributionStrategy.TARGETED:
          assignments = await this.targetTask(task, availableWorkers);
          break;
        
        case TaskDistributionStrategy.AUCTION:
          assignments = await this.auctionTask(task, availableWorkers);
          break;
        
        default:
          throw new ValidationError(`Invalid distribution strategy: ${strategy}`);
      }

      // Notify workers of assignments
      await this.notifyWorkers(assignments);

      this.logger.info('Task distributed successfully', {
        taskId: task.taskId,
        strategy,
        assignmentCount: assignments.length
      });

      return {
        success: true,
        assignments,
        metadata: {
          strategy,
          distributedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Task distribution failed', {
        error,
        taskId: task.taskId,
        strategy
      });
      throw new DistributionError('Failed to distribute task', { cause: error });
    }
  }

  private async broadcastTask(
    task: VerificationTask,
    workers: WorkerProfile[]
  ): Promise<TaskAssignment[]> {
    // Filter eligible workers
    const eligibleWorkers = workers.filter(worker =>
      worker.status === WorkerStatus.AVAILABLE &&
      worker.skills.includes(task.type) &&
      worker.reputationScore >= task.requirements.minReputation
    );

    if (eligibleWorkers.length === 0) {
      throw new DistributionError('No eligible workers for broadcast');
    }

    // Create assignments for all eligible workers
    return eligibleWorkers.map(worker => ({
      taskId: task.taskId,
      workerId: worker.workerId,
      assignedAt: Date.now(),
      status: 'PENDING',
      expiresAt: Date.now() + this.getAssignmentTimeout(task.priority),
      metadata: {
        strategy: TaskDistributionStrategy.BROADCAST,
        distributionTimestamp: new Date().toISOString()
      }
    }));
  }

  private async targetTask(
    task: VerificationTask,
    workers: WorkerProfile[]
  ): Promise<TaskAssignment[]> {
    // Find best matching workers
    const matches = await this.workerMatcher.findBestMatches(
      task,
      workers,
      MatchingStrategy.BALANCED,
      task.requirements.minSubmissions
    );

    // Create assignments for matched workers
    return matches.map(match => ({
      taskId: task.taskId,
      workerId: match.worker.workerId,
      assignedAt: Date.now(),
      status: 'PENDING',
      expiresAt: Date.now() + this.getAssignmentTimeout(task.priority),
      metadata: {
        strategy: TaskDistributionStrategy.TARGETED,
        matchScore: match.score,
        distributionTimestamp: new Date().toISOString()
      }
    }));
  }

  private async auctionTask(
    task: VerificationTask,
    workers: WorkerProfile[]
  ): Promise<TaskAssignment[]> {
    // Create auction
    const auctionId = await this.auctionService.createAuction(
      task,
      workers
    );

    // Wait for auction to complete
    const assignments = await this.auctionService.closeAuction(auctionId);

    return assignments.map(assignment => ({
      ...assignment,
      metadata: {
        ...assignment.metadata,
        strategy: TaskDistributionStrategy.AUCTION,
        distributionTimestamp: new Date().toISOString()
      }
    }));
  }

  private validateDistributionRequirements(
    task: VerificationTask,
    workers: WorkerProfile[]
  ): void {
    if (!task.taskId) {
      throw new ValidationError('Task ID is required');
    }

    if (!task.type) {
      throw new ValidationError('Task type is required');
    }

    if (!task.requirements?.minSubmissions) {
      throw new ValidationError('Minimum submissions requirement is missing');
    }

    const availableWorkers = workers.filter(w => 
      w.status === WorkerStatus.AVAILABLE
    );

    if (availableWorkers.length < task.requirements.minSubmissions) {
      throw new ValidationError(
        `Insufficient available workers. Need ${task.requirements.minSubmissions}, found ${availableWorkers.length}`
      );
    }
  }

  private async notifyWorkers(assignments: TaskAssignment[]): Promise<void> {
    await Promise.all(
      assignments.map(assignment =>
        this.notificationService.notifyWorker(
          assignment.workerId,
          'TASK_ASSIGNED',
          {
            taskId: assignment.taskId,
            expiresAt: assignment.expiresAt,
            metadata: assignment.metadata
          }
        ).catch(error => {
          this.logger.warn('Failed to notify worker', {
            error,
            workerId: assignment.workerId,
            taskId: assignment.taskId
          });
          // Don't fail the distribution if notification fails
          return null;
        })
      )
    );
  }

  private getAssignmentTimeout(priority: TaskPriority): number {
    return this.assignmentTimeouts[priority] || 
           this.assignmentTimeouts[TaskPriority.MEDIUM];
  }
} 