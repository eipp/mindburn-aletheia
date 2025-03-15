import create from 'zustand';
import { devtools } from 'zustand/middleware';
import { Task, TaskFilters, Verification } from '../types';
import { api } from '../services/api';

interface Store {
  // Tasks
  tasks: Task[];
  task: Task | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTasks: (filters: TaskFilters) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  submitVerification: (verification: Verification) => Promise<boolean>;
  
  // Worker Profile
  profile: {
    id: string;
    name: string;
    skills: string[];
    rating: number;
    completedTasks: number;
    balance: number;
  } | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<Store['profile']>) => Promise<void>;
}

export const useStore = create<Store>()(
  devtools(
    (set, get) => ({
      // Initial state
      tasks: [],
      task: null,
      isLoading: false,
      error: null,
      profile: null,

      // Task actions
      fetchTasks: async (filters: TaskFilters) => {
        try {
          set({ isLoading: true, error: null });
          const tasks = await api.tasks.list(filters);
          set({ tasks, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      fetchTask: async (taskId: string) => {
        try {
          set({ isLoading: true, error: null });
          const task = await api.tasks.get(taskId);
          set({ task, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      submitVerification: async (verification: Verification) => {
        try {
          set({ isLoading: true, error: null });
          await api.verifications.submit(verification);
          set({ isLoading: false });
          return true;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      // Profile actions
      fetchProfile: async () => {
        try {
          set({ isLoading: true, error: null });
          const profile = await api.profile.get();
          set({ profile, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },

      updateProfile: async (data: Partial<Store['profile']>) => {
        try {
          set({ isLoading: true, error: null });
          const profile = await api.profile.update(data);
          set({ profile, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      }
    })
  )
); 