import { Address } from '@ton/core';
import { BigNumber } from 'bignumber.js';

export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  CODE_VERIFICATION = 'CODE_VERIFICATION',
  AUDIO_VERIFICATION = 'AUDIO_VERIFICATION'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum VerificationStrategy {
  HUMAN_CONSENSUS = 'HUMAN_CONSENSUS',
  EXPERT_WEIGHTED = 'EXPERT_WEIGHTED',
  AI_ASSISTED = 'AI_ASSISTED',
  GOLDEN_SET = 'GOLDEN_SET',
  HYBRID = 'HYBRID'
}

export interface BaseTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  expiredAt?: string;
  expirationReason?: string;
}

export interface VerificationCriteria {
  accuracy: number;
  timeLimit: number;
  requiredVerifications: number;
  strategy: VerificationStrategy;
}

export interface VerificationTask extends BaseTask {
  data: any;
  criteria: VerificationCriteria;
  assignedWorkers: string[];
  completedVerifications: number;
  aggregatedResult?: any;
  confidence?: number;
}

export interface WorkerTask extends BaseTask {
  title: string;
  description: string;
  reward: number;
  timeLimit: number;
  estimatedDuration: number;
  content: string;
  guidelines: string;
  requiredSkills: string[];
  evidenceTypes: ('image' | 'video' | 'audio' | 'document')[];
}

export interface BaseVerificationResult {
  taskId: string;
  workerId: string;
  result: any;
  confidence: number;
  timeSpent: number;
  submittedAt: string;
  verifiedAt?: string;
}

export interface WorkerVerification extends BaseVerificationResult {
  responses: Record<string, any>;
  evidence: Record<string, Evidence[]>;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  reward?: number;
}

export interface Evidence {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  userId: string;
  telegramId: number;
  walletAddress?: string;
  language: string;
  reputation: number;
  totalTasks: number;
  completedTasks: number;
  earnings: BigNumber;
  lastActive: number;
}

export interface PaymentResult {
  success: boolean;
  txId?: string;
  error?: string;
  amount?: BigNumber;
  fee?: BigNumber;
  status?: 'pending' | 'completed' | 'failed';
} 