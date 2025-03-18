import { Task, Worker } from '@mindburn/shared';

export interface DistributionResult {
  taskId: string;
  eligibleWorkers: string[];
  distributionStrategy: 'broadcast' | 'targeted' | 'auction';
  notificationsSent: number;
  executionId: string;
}

export interface WorkerMatchResult {
  workerId: string;
  matchScore: number;
  skills: Record<string, number>;
  level: number;
  availabilityStatus: string;
}

export interface TaskAssignmentResult {
  taskId: string;
  workerId: string;
  assignedAt: string;
  deadline: string;
  success: boolean;
}

export interface TaskReclaimResult {
  taskId: string;
  workerId: string;
  reclaimedAt: string;
  success: boolean;
}

export interface WorkerMatchCriteria {
  taskType: string;
  requiredSkills: string[];
  minLevel?: number;
  languageCodes?: string[];
  urgency: string;
}

export interface WorkerMatchingService {
  findEligibleWorkers(task: Task, criteria: WorkerMatchCriteria): Promise<WorkerMatchResult[]>;
  calculateMatchScore(worker: Worker, criteria: WorkerMatchCriteria): number;
}

export interface NotificationService {
  notifyWorkers(taskId: string, workerIds: string[], strategy: string): Promise<number>;
}

export interface TaskDistributorConfig {
  maxWorkersPerTask: number;
  minMatchScore: number;
  taskTimeoutMinutes: number;
  urgencyMultipliers: {
    standard: number;
    high: number;
    critical: number;
  };
} 