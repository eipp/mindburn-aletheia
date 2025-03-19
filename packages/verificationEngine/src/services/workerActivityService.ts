import { Logger } from '@mindburn/shared/logger';
import {
  WorkerProfile,
  WorkerStatus,
  TaskAssignment,
  TaskType,
  NotificationService,
} from '../types';

interface ActivityMetrics {
  activeTime: number;
  taskCount: number;
  lastActive: string;
  currentTask?: string;
}

interface PerformanceAlert {
  workerId: string;
  type: 'INACTIVITY' | 'LOW_ACCURACY' | 'SLOW_COMPLETION' | 'HIGH_REJECTION';
  details: string;
  timestamp: string;
}

export class WorkerActivityService {
  private readonly logger: Logger;
  private readonly notificationService: NotificationService;

  private readonly activityThresholds = {
    inactivityWarning: 7 * 24 * 60 * 60 * 1000, // 7 days
    taskTimeout: 2 * 60 * 60 * 1000, // 2 hours
    maxConcurrentTasks: 3,
    minDailyTasks: 5,
    maxDailyTasks: 50,
  };

  private readonly workerActivities = new Map<string, ActivityMetrics>();
  private readonly activeAssignments = new Map<string, Set<string>>();

  constructor(logger: Logger, notificationService: NotificationService) {
    this.logger = logger.child({ service: 'WorkerActivity' });
    this.notificationService = notificationService;
  }

  async updateWorkerStatus(
    worker: WorkerProfile,
    newStatus: WorkerStatus,
    reason?: string
  ): Promise<WorkerProfile> {
    try {
      const oldStatus = worker.status;
      const updatedWorker = {
        ...worker,
        status: newStatus,
        metadata: {
          ...worker.metadata,
          lastStatusChange: {
            from: oldStatus,
            to: newStatus,
            timestamp: new Date().toISOString(),
            reason,
          },
        },
      };

      this.logger.info('Worker status updated', {
        workerId: worker.workerId,
        oldStatus,
        newStatus,
        reason,
      });

      // Notify worker of status change if significant
      if (this.shouldNotifyStatusChange(oldStatus, newStatus)) {
        await this.notificationService.notifyWorker(worker.workerId, 'STATUS_CHANGE', {
          oldStatus,
          newStatus,
          reason,
        });
      }

      return updatedWorker;
    } catch (error) {
      this.logger.error('Failed to update worker status', {
        error,
        workerId: worker.workerId,
      });
      throw error;
    }
  }

  async trackTaskAssignment(worker: WorkerProfile, assignment: TaskAssignment): Promise<void> {
    const workerId = worker.workerId;

    // Update active assignments
    if (!this.activeAssignments.has(workerId)) {
      this.activeAssignments.set(workerId, new Set());
    }
    this.activeAssignments.get(workerId)?.add(assignment.taskId);

    // Update activity metrics
    const currentActivity = this.workerActivities.get(workerId) || {
      activeTime: 0,
      taskCount: 0,
      lastActive: new Date().toISOString(),
    };

    this.workerActivities.set(workerId, {
      ...currentActivity,
      taskCount: currentActivity.taskCount + 1,
      lastActive: new Date().toISOString(),
      currentTask: assignment.taskId,
    });

    // Check for overload
    if (this.isWorkerOverloaded(workerId)) {
      await this.handleWorkerOverload(worker);
    }
  }

  async trackTaskCompletion(worker: WorkerProfile, assignment: TaskAssignment): Promise<void> {
    const workerId = worker.workerId;

    // Remove from active assignments
    this.activeAssignments.get(workerId)?.delete(assignment.taskId);

    // Update activity metrics
    const currentActivity = this.workerActivities.get(workerId);
    if (currentActivity) {
      const timeSpent = Date.now() - new Date(assignment.assignedAt).getTime();
      this.workerActivities.set(workerId, {
        ...currentActivity,
        activeTime: currentActivity.activeTime + timeSpent,
        lastActive: new Date().toISOString(),
        currentTask: undefined,
      });
    }

    // Update worker status if needed
    if (this.activeAssignments.get(workerId)?.size === 0) {
      await this.updateWorkerStatus(worker, WorkerStatus.AVAILABLE);
    }
  }

  async monitorWorkerActivity(worker: WorkerProfile): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    const activity = this.workerActivities.get(worker.workerId);

    if (!activity) {
      return alerts;
    }

    // Check for inactivity
    const inactiveDuration = Date.now() - new Date(activity.lastActive).getTime();
    if (inactiveDuration > this.activityThresholds.inactivityWarning) {
      alerts.push({
        workerId: worker.workerId,
        type: 'INACTIVITY',
        details: `Inactive for ${Math.floor(inactiveDuration / (24 * 60 * 60 * 1000))} days`,
        timestamp: new Date().toISOString(),
      });
    }

    // Check task completion rate
    const dailyTasks = activity.taskCount; // Simplified, should be per day
    if (dailyTasks < this.activityThresholds.minDailyTasks) {
      alerts.push({
        workerId: worker.workerId,
        type: 'LOW_ACCURACY',
        details: `Only ${dailyTasks} tasks completed today`,
        timestamp: new Date().toISOString(),
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.handlePerformanceAlert(worker, alert);
    }

    return alerts;
  }

  getWorkerActivity(workerId: string): ActivityMetrics | undefined {
    return this.workerActivities.get(workerId);
  }

  getActiveWorkers(): string[] {
    const now = Date.now();
    const activeWorkers: string[] = [];

    this.workerActivities.forEach((activity, workerId) => {
      const lastActiveTime = new Date(activity.lastActive).getTime();
      if (now - lastActiveTime < 24 * 60 * 60 * 1000) {
        // Active in last 24h
        activeWorkers.push(workerId);
      }
    });

    return activeWorkers;
  }

  private isWorkerOverloaded(workerId: string): boolean {
    const activeTaskCount = this.activeAssignments.get(workerId)?.size || 0;
    return activeTaskCount >= this.activityThresholds.maxConcurrentTasks;
  }

  private async handleWorkerOverload(worker: WorkerProfile): Promise<void> {
    await this.updateWorkerStatus(worker, WorkerStatus.BUSY, 'Maximum concurrent tasks reached');

    await this.notificationService.notifyWorker(worker.workerId, 'WORKLOAD_WARNING', {
      activeTaskCount: this.activeAssignments.get(worker.workerId)?.size,
      maxTasks: this.activityThresholds.maxConcurrentTasks,
    });
  }

  private async handlePerformanceAlert(
    worker: WorkerProfile,
    alert: PerformanceAlert
  ): Promise<void> {
    this.logger.warn('Worker performance alert', {
      workerId: worker.workerId,
      alertType: alert.type,
      details: alert.details,
    });

    // Notify worker
    await this.notificationService.notifyWorker(worker.workerId, 'PERFORMANCE_ALERT', {
      type: alert.type,
      details: alert.details,
    });

    // Update status for severe cases
    if (alert.type === 'INACTIVITY') {
      await this.updateWorkerStatus(worker, WorkerStatus.SUSPENDED, 'Extended inactivity');
    }
  }

  private shouldNotifyStatusChange(oldStatus: WorkerStatus, newStatus: WorkerStatus): boolean {
    // Notify on significant status changes
    return (
      (oldStatus === WorkerStatus.AVAILABLE && newStatus === WorkerStatus.SUSPENDED) ||
      (oldStatus === WorkerStatus.SUSPENDED && newStatus === WorkerStatus.AVAILABLE) ||
      newStatus === WorkerStatus.BUSY
    );
  }

  async generateActivityReport(worker: WorkerProfile): Promise<{
    dailyStats: {
      date: string;
      taskCount: number;
      activeTime: number;
      averageTaskTime: number;
    }[];
    weeklyStats: {
      taskCount: number;
      activeTime: number;
      completionRate: number;
    };
    alerts: PerformanceAlert[];
  }> {
    // TODO: Implement detailed activity reporting
    return {
      dailyStats: [],
      weeklyStats: {
        taskCount: 0,
        activeTime: 0,
        completionRate: 0,
      },
      alerts: [],
    };
  }
}
