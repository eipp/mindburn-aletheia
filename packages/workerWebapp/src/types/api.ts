import { TaskType, ContentType, VerificationStatus, PaymentType, PaymentStatus } from './enums';

export interface Worker {
  workerId: string;
  displayName: string;
  level: number;
  skills: string[];
  balance: number;
  taskStats: {
    completed: number;
    accuracy: number;
  };
}

export interface Task {
  taskId: string;
  type: TaskType;
  contentType: ContentType;
  reward: number;
  estimatedTime: number;
  priority: 'low' | 'medium' | 'high';
  content?: string | {
    url: string;
    hash: string;
  };
  deadline?: string;
  timeRemaining?: number;
  acceptedAt?: string;
}

export interface VerificationField {
  id: string;
  type: 'radio' | 'checkbox' | 'text' | 'select';
  label: string;
  required: boolean;
  options?: string[];
}

export interface VerificationForm {
  fields: VerificationField[];
}

export interface TaskDetails extends Task {
  taskDetails: {
    type: TaskType;
    contentType: ContentType;
    contentUrl: string;
    instructions: string;
    verificationForm: VerificationForm;
  };
}

export interface VerificationSubmission {
  workerId: string;
  taskId: string;
  responses: {
    [fieldId: string]: string | string[] | boolean;
  };
  confidence?: number;
  timeSpent: number;
}

export interface Payment {
  id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  timestamp: string;
  taskId?: string;
  transactionHash?: string;
}

export interface PaymentHistory {
  currentBalance: number;
  pendingBalance: number;
  totalEarned: number;
  payments: Payment[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    nextOffset?: number;
  };
}

export interface WithdrawalRequest {
  withdrawalId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: PaymentStatus;
  estimatedCompletionTime: string;
  requestedAt: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: any;
} 