import { Address } from '@mindburn/shared/types';

export enum TaskStatus {
  CREATED = 'CREATED',
  PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFICATION_PENDING = 'VERIFICATION_PENDING',
  VERIFICATION_COMPLETE = 'VERIFICATION_COMPLETE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TaskDistributionStrategy {
  BROADCAST = 'BROADCAST',
  TARGETED = 'TARGETED',
  AUCTION = 'AUCTION',
}

export enum TaskUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface VerificationRequirements {
  type: string;
  requiredSkills: string[];
  minVerifierLevel: number;
  languageCodes: string[];
  urgency: TaskUrgency;
  verificationThreshold: number;
  timeoutMinutes: number;
}

export interface TaskRequirements {
  minWorkerLevel: number;
  requiredSkills: string[];
  verificationThreshold: number;
  maxTimeoutMinutes: number;
}

export interface TaskCost {
  baseReward: number;
  bonusReward?: number;
  platformFee: number;
  totalCost: number;
}

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  verificationRequirements: VerificationRequirements;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  eligibleWorkers?: string[];
  assignedWorkers?: string[];
  completedVerifications?: number;
  statusReason?: string;
  expiresAt?: string;
}

export interface WorkerMatchResult {
  workerId: string;
  matchScore: number;
  skills: string[];
  level: number;
  languageCodes: string[];
  activeTaskCount: number;
  successRate: number;
}

export interface DistributionResult {
  taskId: string;
  eligibleWorkers: string[];
  distributionStrategy: TaskDistributionStrategy;
  notificationsSent: number;
  executionId: string;
}

export interface TaskCreationInput {
  title: string;
  description: string;
  verificationRequirements: Omit<VerificationRequirements, 'type'> & {
    type?: string;
  };
  metadata?: Record<string, any>;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  verificationRequirements?: Partial<VerificationRequirements>;
  metadata?: Record<string, any>;
}

export interface TaskQueryParams {
  status?: TaskStatus[];
  createdBy?: string;
  fromDate?: string;
  toDate?: string;
  type?: string;
  limit?: number;
  nextToken?: string;
}

export interface TaskSubmission {
  taskId: string;
  workerId: string;
  result: unknown;
  submittedAt: number;
  timeSpentSeconds: number;
}

export enum WorkerAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

export interface WorkerProfile {
  workerId: string;
  level: number;
  skills: string[];
  reputation: number;
  availabilityStatus: WorkerAvailabilityStatus;
  walletAddress: Address;
  activeTaskCount: number;
  completedTaskCount: number;
  successRate: number;
}
