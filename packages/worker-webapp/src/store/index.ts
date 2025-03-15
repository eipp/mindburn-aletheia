import create from 'zustand';
import { devtools } from 'zustand/middleware';
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
  evidence: Record<string, { type: string; url: string; description?: string; }[]>;
  timeSpent: number;
}

interface State {
  isLoading: boolean;
  error: string | null;
  tasks: ExtendedTask[];
  task: ExtendedTask | null;
  profile: WorkerProfile | null;
  transactions: Transaction[];
  walletService: WalletService;
  fetchTasks: () => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  submitVerification: (data: VerificationData) => Promise<boolean>;
  updateProfile: (updates: Partial<WorkerProfile>) => Promise<void>;
  connectWallet: (address: string) => Promise<void>;
  withdrawFunds: (amount: number, address: string) => Promise<void>;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export const useStore = create<State>()(
  devtools(
    (set, get) => ({
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
            body: JSON.stringify(data)
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
            body: JSON.stringify(updates)
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
      }
    })
  )
); 