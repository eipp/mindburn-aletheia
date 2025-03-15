import { Context as TelegrafContext } from 'telegraf';

export interface UserSession {
  userId: string;
  telegramId: number;
  walletAddress?: string;
  state: UserState;
  currentTask?: string;
  lastActive: number;
  language: string;
  reputation: number;
  totalTasks: number;
  completedTasks: number;
  earnings: number;
}

export enum UserState {
  INITIAL = 'INITIAL',
  REGISTERING = 'REGISTERING',
  CONNECTING_WALLET = 'CONNECTING_WALLET',
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUBMITTING = 'SUBMITTING',
}

export interface Task {
  id: string;
  type: TaskType;
  data: Record<string, any>;
  reward: number;
  deadline: number;
  status: TaskStatus;
  assignedTo?: string;
  submittedAt?: number;
  result?: Record<string, any>;
}

export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  AUDIO_VERIFICATION = 'AUDIO_VERIFICATION',
  CODE_VERIFICATION = 'CODE_VERIFICATION',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface BotContext extends TelegrafContext {
  session: UserSession;
} 