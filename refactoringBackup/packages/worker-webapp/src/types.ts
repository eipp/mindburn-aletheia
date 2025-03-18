import { ReactNode } from 'react';

export interface LayoutProps {
  children?: ReactNode;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorAlertProps {
  error: string | null;
}

export interface TaskCardProps {
  task: Task;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  timeEstimate: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'open' | 'in_progress' | 'completed' | 'expired';
  category: string;
  requirements: string[];
  expiresAt: string;
  tags: string[];
}

export interface User {
  id: string;
  username: string;
  balance: number;
  reputation: number;
}

export interface UserStats {
  balance: number;
  reputation: number;
  tasksCompleted: number;
  successRate: number;
  totalEarned: number;
  averageRating: number;
  recentActivity: Activity[];
}

export interface Activity {
  type: 'earned' | 'withdrawn';
  amount: number;
  description: string;
  timestamp: string;
}

export interface Transaction {
  type: 'earned' | 'withdrawn';
  amount: number;
  description: string;
  timestamp: string;
}

export interface EarningsData {
  balance: number;
  totalEarned: number;
  tasksCompleted: number;
  averagePerTask: number;
  transactions: Transaction[];
}

export interface UserSettings {
  notifications: {
    taskUpdates: boolean;
    paymentUpdates: boolean;
    newTasks: boolean;
  };
  preferences: {
    language: string;
    minReward: number;
    maxDifficulty: 'easy' | 'medium' | 'hard';
  };
} 