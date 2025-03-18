import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  TaskStatus,
  TaskAssignment,
  TaskEvent,
  TaskPriority,
  TaskTransitionError
} from '../types';
import { ValidationError } from '../errors';

interface TaskStatusConfig {
  allowedTransitions: TaskStatus[];
  requiresValidation: boolean;
  timeoutInMs?: number;
}

export class TaskLifecycleService {
  private readonly logger: Logger;
  private readonly statusConfigs: Record<TaskStatus, TaskStatusConfig> = {
    CREATED: {
      allowedTransitions: ['PENDING_DISTRIBUTION', 'CANCELLED'],
      requiresValidation: false
    },
    PENDING_DISTRIBUTION: {
      allowedTransitions: ['DISTRIBUTED', 'CANCELLED'],
      requiresValidation: true,
      timeoutInMs: 5 * 60 * 1000 // 5 minutes
    },
    DISTRIBUTED: {
      allowedTransitions: ['IN_PROGRESS', 'EXPIRED', 'CANCELLED'],
      requiresValidation: false
    },
    IN_PROGRESS: {
      allowedTransitions: ['PENDING_REVIEW', 'EXPIRED', 'CANCELLED'],
      requiresValidation: true,
      timeoutInMs: 30 * 60 * 1000 // 30 minutes
    },
    PENDING_REVIEW: {
      allowedTransitions: ['COMPLETED', 'NEEDS_REVISION', 'CANCELLED'],
      requiresValidation: true,
      timeoutInMs: 15 * 60 * 1000 // 15 minutes
    },
    NEEDS_REVISION: {
      allowedTransitions: ['IN_PROGRESS', 'CANCELLED'],
      requiresValidation: true
    },
    COMPLETED: {
      allowedTransitions: ['ARCHIVED'],
      requiresValidation: false
    },
    EXPIRED: {
      allowedTransitions: ['ARCHIVED'],
      requiresValidation: false
    },
    CANCELLED: {
      allowedTransitions: ['ARCHIVED'],
      requiresValidation: false
    },
    ARCHIVED: {
      allowedTransitions: [],
      requiresValidation: false
    }
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'TaskLifecycle' });
  }

  async transitionTask(
    task: VerificationTask,
    newStatus: TaskStatus,
    metadata?: Record<string, any>
  ): Promise<VerificationTask> {
    try {
      this.validateTransition(task.status, newStatus);

      const event: TaskEvent = {
        taskId: task.taskId,
        fromStatus: task.status,
        toStatus: newStatus,
        timestamp: new Date().toISOString(),
        metadata
      };

      // Update task status
      const updatedTask = {
        ...task,
        status: newStatus,
        lastUpdated: new Date().toISOString(),
        statusHistory: [...(task.statusHistory || []), event]
      };

      // Log the transition
      this.logger.info('Task status transition', {
        taskId: task.taskId,
        fromStatus: task.status,
        toStatus: newStatus,
        metadata
      });

      return updatedTask;

    } catch (error) {
      this.logger.error('Task status transition failed', {
        error,
        taskId: task.taskId,
        fromStatus: task.status,
        toStatus: newStatus
      });
      throw error;
    }
  }

  async handleTaskExpiration(
    task: VerificationTask,
    assignments: TaskAssignment[]
  ): Promise<VerificationTask> {
    if (!this.isTaskExpired(task, assignments)) {
      return task;
    }

    return this.transitionTask(task, 'EXPIRED', {
      reason: 'Task exceeded maximum allowed time',
      expiredAssignments: assignments
        .filter(a => this.isAssignmentExpired(a))
        .map(a => a.workerId)
    });
  }

  private validateTransition(
    currentStatus: TaskStatus,
    newStatus: TaskStatus
  ): void {
    const config = this.statusConfigs[currentStatus];
    if (!config) {
      throw new ValidationError(`Invalid current status: ${currentStatus}`);
    }

    if (!config.allowedTransitions.includes(newStatus)) {
      throw new TaskTransitionError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private isTaskExpired(
    task: VerificationTask,
    assignments: TaskAssignment[]
  ): boolean {
    // Check if task has exceeded its maximum allowed time
    const config = this.statusConfigs[task.status];
    if (config?.timeoutInMs) {
      const taskAge = Date.now() - new Date(task.createdAt).getTime();
      if (taskAge > this.getMaxTaskDuration(task.priority)) {
        return true;
      }
    }

    // Check if all assignments have expired
    const activeAssignments = assignments.filter(
      a => !this.isAssignmentExpired(a)
    );
    return activeAssignments.length === 0;
  }

  private isAssignmentExpired(assignment: TaskAssignment): boolean {
    return Date.now() > assignment.expiresAt;
  }

  private getMaxTaskDuration(priority: TaskPriority): number {
    const baseTimeout = 24 * 60 * 60 * 1000; // 24 hours
    const priorityMultipliers = {
      [TaskPriority.HIGH]: 0.5, // 12 hours
      [TaskPriority.MEDIUM]: 1, // 24 hours
      [TaskPriority.LOW]: 2 // 48 hours
    };

    return baseTimeout * (priorityMultipliers[priority] || 1);
  }

  getTaskTimeline(task: VerificationTask): TaskEvent[] {
    return task.statusHistory || [];
  }

  getTaskAge(task: VerificationTask): number {
    return Date.now() - new Date(task.createdAt).getTime();
  }

  getTimeInStatus(task: VerificationTask): number {
    const lastTransition = task.statusHistory?.[task.statusHistory.length - 1];
    if (!lastTransition) {
      return this.getTaskAge(task);
    }
    return Date.now() - new Date(lastTransition.timestamp).getTime();
  }

  getRemainingTime(task: VerificationTask): number {
    const config = this.statusConfigs[task.status];
    if (!config?.timeoutInMs) {
      return Infinity;
    }

    const timeInStatus = this.getTimeInStatus(task);
    return Math.max(0, config.timeoutInMs - timeInStatus);
  }
} 