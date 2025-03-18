export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  CODE_VERIFICATION = 'CODE_VERIFICATION'
}

export enum WorkerStatus {
  ACTIVE = 'ACTIVE',
  BUSY = 'BUSY',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE'
}

export enum MetricType {
  ACCURACY = 'ACCURACY',
  RESPONSE_RATE = 'RESPONSE_RATE',
  COMPLETION_RATE = 'COMPLETION_RATE',
  AVERAGE_TIME = 'AVERAGE_TIME'
}

export interface Task {
  taskId: string;
  type: TaskType;
  status: TaskStatus;
  data: any;
  requiredVerifications: number;
  completedVerifications: number;
  verificationCriteria: {
    accuracy: number;
    timeLimit: number;
  };
  assignedWorkers: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  expiredAt?: string;
  expirationReason?: string;
  aggregatedResult?: any;
  confidence?: number;
}

export interface Worker {
  workerId: string;
  status: WorkerStatus;
  qualifications: {
    taskTypes: TaskType[];
    languages?: string[];
    specializations?: string[];
  };
  currentLoad: number;
  maxLoad: number;
  telegramId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  taskId: string;
  workerId: string;
  result: any;
  confidence: number;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  submittedAt: string;
  verifiedAt?: string;
}

export interface WorkerMetric {
  workerId: string;
  metricType: MetricType;
  value: number;
  updatedAt: string;
}

export interface TaskAssignment {
  taskId: string;
  workerId: string;
  assignedAt: string;
  deadline: string;
  status: 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'EXPIRED';
}

export interface ErrorResponse {
  errorCode: string;
  message: string;
  details?: any;
  timestamp: string;
} 