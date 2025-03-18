export interface BaseTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  AUDIO_VERIFICATION = 'AUDIO_VERIFICATION',
  VIDEO_VERIFICATION = 'VIDEO_VERIFICATION',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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
