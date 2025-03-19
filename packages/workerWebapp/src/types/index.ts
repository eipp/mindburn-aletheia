export enum TaskType {
  TEXT = 'text',
  IMAGE = 'image',
  CODE = 'code',
  DATA = 'data',
  AUDIO = 'audio',
}

export enum TaskStatus {
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  URGENT = 'urgent',
}

export enum EvidenceType {
  SCREENSHOT = 'screenshot',
  TEXT = 'text',
  LINK = 'link',
  FILE = 'file',
}

export interface Evidence {
  type: EvidenceType;
  content: string;
  timestamp: number;
}

export interface VerificationStep {
  id: string;
  title: string;
  instruction: string;
  requiredEvidence: EvidenceType[];
  minConfidence: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  reward: number;
  timeLimit: number; // in minutes
  estimatedDuration: number; // in minutes
  content: string;
  steps: VerificationStep[];
  guidelines: string;
  evidenceTypes: EvidenceType[];
  requiredSkills: string[];
  createdAt: number;
  expiresAt: number;
}

export interface TaskFilters {
  type?: TaskType;
  duration?: 'short' | 'medium' | 'long';
  reward?: 'low' | 'medium' | 'high';
  skills?: string[];
  status?: TaskStatus;
}

export interface Verification {
  taskId: string;
  responses: Record<string, any>;
  confidence: Record<string, number>;
  evidence: Record<string, Evidence[]>;
  timeSpent: number;
  submittedAt?: number;
  status?: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  reward?: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
  skills: string[];
  rating: number;
  completedTasks: number;
  successRate: number;
  balance: number;
  level: number;
  experience: number;
  badges: Badge[];
  joinedAt: number;
  lastActive: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
}

export interface Transaction {
  id: string;
  type: 'reward' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  details: {
    taskId?: string;
    address?: string;
    txHash?: string;
  };
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: number;
  reward: number;
  status: 'locked' | 'available' | 'completed';
  prerequisites: string[];
  skills: string[];
  content: {
    type: 'video' | 'text' | 'quiz';
    data: any;
  }[];
}

export interface TrainingProgress {
  completedModules: string[];
  currentModule?: string;
  earnedRewards: number;
  skillLevels: Record<string, number>;
  nextAvailableModules: string[];
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
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
