export enum TaskType {
  TEXT_VERIFICATION = 'TEXT_VERIFICATION',
  IMAGE_VERIFICATION = 'IMAGE_VERIFICATION',
  AUDIO_VERIFICATION = 'AUDIO_VERIFICATION',
  VIDEO_VERIFICATION = 'VIDEO_VERIFICATION',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  data: {
    content: string;
    instructions: string;
    options?: string[];
    metadata?: Record<string, unknown>;
  };
  reward: number;
  deadline: number;
  assignedTo?: string;
  submittedAt?: number;
  result?: TaskSubmission;
}

export interface TaskSubmission {
  taskId: string;
  answer: string | boolean | number | Record<string, unknown>;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  userId: string;
  telegramId: number;
  walletAddress?: string;
  language: string;
  reputation: number;
  totalTasks: number;
  completedTasks: number;
  earnings: number;
  lastActive: number;
  preferences?: {
    taskTypes: TaskType[];
    notifications: boolean;
    theme: 'light' | 'dark';
  };
}

export interface WalletState {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
} 