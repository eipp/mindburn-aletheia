import { Task, Worker, VerificationResult } from '@mindburn/shared';

export interface WorkflowInput {
  taskId: string;
  requiredVerifiers: number;
  timeoutMinutes: number;
  retryConfig: {
    maxAttempts: number;
    backoffRate: number;
  };
}

export interface WorkerMatchingOutput {
  taskId: string;
  eligibleWorkers: string[];
  matchingStrategy: 'broadcast' | 'targeted' | 'auction';
  matchingScore: number;
}

export interface NotificationOutput {
  taskId: string;
  notifiedWorkers: string[];
  acceptedWorkers: string[];
  notificationTimestamp: string;
}

export interface TaskStatusOutput {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  verifierCount: number;
  timeElapsed: number;
  isTimeout: boolean;
}

export interface ResultConsolidationOutput {
  taskId: string;
  verificationResults: VerificationResult[];
  consensusReached: boolean;
  finalVerdict: string;
  confidenceScore: number;
}

export interface PaymentProcessingOutput {
  taskId: string;
  payments: {
    workerId: string;
    amount: number;
    status: 'pending' | 'processed' | 'failed';
  }[];
  totalPaid: number;
}

export interface TaskCompletionOutput {
  taskId: string;
  status: 'success' | 'failure';
  completionTime: string;
  metrics: {
    totalVerifiers: number;
    consensusScore: number;
    averageResponseTime: number;
  };
}

export interface TaskFailureOutput {
  taskId: string;
  failureReason: string;
  failureTimestamp: string;
  recoveryAttempts: number;
  isRecoverable: boolean;
}

export interface WorkflowContext {
  executionId: string;
  startTime: string;
  taskData: Task;
  selectedWorkers: Worker[];
  currentAttempt: number;
  errors: Error[];
}
