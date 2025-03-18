import {
  TaskType,
  TaskStatus,
  WorkerTask,
  WorkerVerification,
  Evidence
} from '@mindburn/shared';

export interface WorkerProfile {
  id: string;
  telegramId?: number;
  walletAddress?: string;
  name: string;
  skills: string[];
  languages: string[];
  reputation: number;
  tasksCompleted: number;
  successRate: number;
  averageSpeed: number;
  lastActive: Date;
  status: 'available' | 'busy' | 'offline';
}

export interface WorkerPreferences {
  taskTypes: TaskType[];
  minReward: number;
  maxDuration: number;
  languages: string[];
  notificationChannels: ('telegram' | 'email' | 'webapp')[];
  autoAccept: boolean;
  workSchedule?: {
    timezone: string;
    availableHours: Array<{
      day: number;
      start: string;
      end: string;
    }>;
  };
}

export interface TaskAssignment {
  taskId: string;
  workerId: string;
  assignedAt: Date;
  deadline: Date;
  status: TaskStatus;
  verificationResult?: WorkerVerification;
}

export interface WorkSession {
  taskId: string;
  workerId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  checkpoints: Array<{
    timestamp: Date;
    action: string;
    metadata?: Record<string, any>;
  }>;
}

export interface WorkerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageAccuracy: number;
  averageSpeed: number;
  totalEarnings: number;
  reputationScore: number;
  skillLevels: Record<string, number>;
  activityHeatmap: Record<string, number>;
}

export interface TaskSubmission {
  taskId: string;
  workerId: string;
  timestamp: Date;
  responses: Record<string, any>;
  evidence: Evidence[];
  duration: number;
  confidence: number;
  notes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkerError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
} 