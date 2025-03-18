import { Context } from 'telegraf';
import { Update, Message, User } from 'telegraf/types';

export interface SessionData {
  userId: string;
  walletAddress?: string;
  currentTaskId?: string;
  verificationStep?: number;
  lastMessageId?: number;
  state?: BotState;
  data?: Record<string, any>;
}

export interface WorkerBotContext extends Context {
  session: SessionData;
  state: {
    command?: string;
    args?: string[];
  };
}

export enum BotState {
  IDLE = 'IDLE',
  AWAITING_WALLET = 'AWAITING_WALLET',
  VERIFYING_TASK = 'VERIFYING_TASK',
  WITHDRAWING = 'WITHDRAWING',
  TRAINING = 'TRAINING'
}

export interface Task {
  id: string;
  type: TaskType;
  prompt: string;
  data: Record<string, any>;
  reward: number;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  AUDIO_VERIFICATION = 'AUDIO_VERIFICATION',
  VIDEO_VERIFICATION = 'VIDEO_VERIFICATION'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface WorkerProfile {
  userId: string;
  telegramId: number;
  username?: string;
  walletAddress?: string;
  rating: number;
  tasksCompleted: number;
  totalEarned: number;
  level: number;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  taskId?: string;
  createdAt: number;
  updatedAt: number;
}

export enum TransactionType {
  REWARD = 'REWARD',
  WITHDRAWAL = 'WITHDRAWAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
} 