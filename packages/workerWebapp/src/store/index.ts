import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Task, User, VerificationSubmission, UserStats } from '@mindburn/shared';
import { BaseTask, TaskType, TaskStatus, WorkerProfile, Transaction } from '@mindburn/shared/types';
import { WalletService } from '../services/wallet';

interface ExtendedTask extends BaseTask {
  title: string;
  description: string;
  reward: number;
  timeLimit: number;
  estimatedDuration: number;
  content: string;
  steps: {
    id: string;
    title: string;
    description: string;
    type: 'text' | 'choice' | 'rating' | 'evidence';
    options?: string[];
    required: boolean;
  }[];
  guidelines: string;
  evidenceTypes: ('image' | 'video' | 'audio' | 'document')[];
  requiredSkills: string[];
}

interface VerificationData {
  taskId: string;
  responses: Record<string, any>;
  confidence: Record<string, number>;
  evidence: Record<string, { type: string; url: string; description?: string }[]>;
  timeSpent: number;
}

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  timestamp: number;
}

interface AppState {
  isLoading: boolean;
  error: string | null;
  user: User | null;
  stats: UserStats | null;
  tasks: Task[];
  selectedTask: Task | null;
  notifications: Notification[];
  submissions: VerificationSubmission[];
  filters: {
    status: string[];
    category: string[];
    difficulty: string[];
    reward: [number, number];
  };
  actions: {
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setUser: (user: User | null) => void;
    setStats: (stats: UserStats | null) => void;
    setTasks: (tasks: Task[]) => void;
    updateTask: (task: Task) => void;
    setSelectedTask: (task: Task | null) => void;
    updateBalance: (balance: number) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
    addSubmission: (submission: VerificationSubmission) => void;
    updateFilters: (filters: Partial<AppState['filters']>) => void;
    clearFilters: () => void;
  };
}

const initialFilters = {
  status: [],
  category: [],
  difficulty: [],
  reward: [0, 1000],
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      immer((set, get) => ({
        isLoading: true,
        error: null,
        user: null,
        stats: null,
        tasks: [],
        selectedTask: null,
        notifications: [],
        submissions: [],
        filters: initialFilters,
        actions: {
          setIsLoading: isLoading =>
            set(state => {
              state.isLoading = isLoading;
            }),
          setError: error =>
            set(state => {
              state.error = error;
            }),
          setUser: user =>
            set(state => {
              state.user = user;
            }),
          setStats: stats =>
            set(state => {
              state.stats = stats;
            }),
          setTasks: tasks =>
            set(state => {
              state.tasks = tasks;
            }),
          updateTask: task =>
            set(state => ({
              tasks: state.tasks.map(t => (t.id === task.id ? task : t)),
              selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
            })),
          setSelectedTask: task =>
            set(state => {
              state.selectedTask = task;
            }),
          updateBalance: balance =>
            set(state => ({
              user: state.user ? { ...state.user, balance } : null,
            })),
          addNotification: notification =>
            set(state => ({
              notifications: [
                {
                  ...notification,
                  id: Math.random().toString(36).substr(2, 9),
                  timestamp: Date.now(),
                },
                ...state.notifications,
              ].slice(0, 5), // Keep only the 5 most recent notifications
            })),
          removeNotification: id =>
            set(state => ({
              notifications: state.notifications.filter(n => n.id !== id),
            })),
          addSubmission: submission =>
            set(state => {
              state.submissions.push(submission);
            }),
          updateFilters: filters =>
            set(state => {
              state.filters = { ...state.filters, ...filters };
            }),
          clearFilters: () =>
            set(state => {
              state.filters = initialFilters;
            }),
        },
      })),
      {
        name: 'mindburn-storage',
        partialize: state => ({
          user: state.user,
          filters: state.filters,
        }),
      }
    )
  )
);

export const useStore = create<State>()(
  devtools((set, get) => ({
    isLoading: false,
    error: null,
    tasks: [],
    task: null,
    profile: null,
    transactions: [],
    walletService: new WalletService(),

    fetchTasks: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const tasks = await response.json();
        set({ tasks, isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    fetchTask: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
        if (!response.ok) throw new Error('Failed to fetch task');
        const task = await response.json();
        set({ task, isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    fetchProfile: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        if (!response.ok) throw new Error('Failed to fetch profile');
        const profile = await response.json();
        set({ profile, isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    fetchTransactions: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/transactions`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const transactions = await response.json();
        set({ transactions, isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    submitVerification: async (data: VerificationData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${data.taskId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to submit verification');
        set({ isLoading: false });
        return true;
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
        return false;
      }
    },

    updateProfile: async (updates: Partial<WorkerProfile>) => {
      set({ isLoading: true, error: null });
      try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update profile');
        const profile = await response.json();
        set({ profile, isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    connectWallet: async (address: string) => {
      set({ isLoading: true, error: null });
      try {
        const { walletService } = get();
        const balance = await walletService.getBalance(address);
        await get().updateProfile({ walletAddress: address });
        set({ isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },

    withdrawFunds: async (amount: number, address: string) => {
      set({ isLoading: true, error: null });
      try {
        const { walletService } = get();
        await walletService.withdraw(amount, address);
        await get().fetchTransactions();
        set({ isLoading: false });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      }
    },
  }))
);
