import { Context } from 'telegraf';
import { I18nContext } from '@telegraf/i18n';

export interface WorkerProfile {
  userId: string;
  username?: string;
  status: 'active' | 'banned' | 'pending';
  level: number;
  rating: number;
  tasksCompleted: number;
  totalEarned: number;
  walletAddress?: string;
  taskPreferences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubmission {
  taskId: string;
  workerId: string;
  answer: string;
  confidence: number;
  timeSpent: number;
  submittedAt: string;
}

export interface DeviceFingerprint {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution?: string;
}

export interface WorkerMetrics {
  dailyTasks: number;
  weeklyTasks: number;
  monthlyTasks: number;
  averageAccuracy: number;
  averageSpeed: number;
  lastActive: string;
}

export interface BotContext extends Context {
  i18n: I18nContext;
  session: {
    step?: string;
    data?: Record<string, any>;
    language?: string;
  };
  state: {
    worker?: WorkerProfile;
    metrics?: WorkerMetrics;
    deviceFingerprint?: DeviceFingerprint;
  };
}

export interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  reasons: string[];
  deviceTrust: number;
  ipTrust: number;
  behaviorTrust: number;
}

export enum ExpertiseLevel {
  NOVICE = 'novice',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
  MASTER = 'master'
}

export interface QualityMetrics {
  accuracy: number;
  speed: number;
  consistency: number;
  complexity: number;
}

export interface WorkerStats {
  tasksToday: number;
  tasksWeek: number;
  tasksMonth: number;
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;
  experience: number;
  nextLevelThreshold: number;
}

export interface TaskDetails {
  id: string;
  type: string;
  complexity: number;
  reward: number;
  deadline: string;
  description: string;
  requirements: string[];
  status: 'available' | 'in_progress' | 'completed' | 'expired';
}

export interface WalletInfo {
  address: string;
  balance: number;
  pendingBalance: number;
  lastWithdrawal?: {
    amount: number;
    timestamp: string;
    status: 'pending' | 'completed' | 'failed';
  };
} 