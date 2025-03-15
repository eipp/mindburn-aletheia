import axios from 'axios';
import { Task, TaskFilters, Verification } from '../types';

const instance = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for API calls
instance.interceptors.request.use(
  async config => {
    const telegramWebApp = (window as any).Telegram?.WebApp;
    if (telegramWebApp) {
      config.headers = {
        ...config.headers,
        'X-Telegram-Init-Data': telegramWebApp.initData,
        'X-Telegram-User': JSON.stringify(telegramWebApp.initDataUnsafe?.user)
      };
    }
    return config;
  },
  error => {
    Promise.reject(error);
  }
);

// Response interceptor for API calls
instance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Handle token refresh or re-authentication here if needed
      return instance(originalRequest);
    }

    return Promise.reject(error);
  }
);

export const api = {
  tasks: {
    list: async (filters: TaskFilters): Promise<Task[]> => {
      const { data } = await instance.get('/tasks', { params: filters });
      return data;
    },

    get: async (taskId: string): Promise<Task> => {
      const { data } = await instance.get(`/tasks/${taskId}`);
      return data;
    }
  },

  verifications: {
    submit: async (verification: Verification): Promise<void> => {
      await instance.post('/verifications', verification);
    },

    getHistory: async (): Promise<Verification[]> => {
      const { data } = await instance.get('/verifications/history');
      return data;
    }
  },

  profile: {
    get: async () => {
      const { data } = await instance.get('/profile');
      return data;
    },

    update: async (profileData: any) => {
      const { data } = await instance.patch('/profile', profileData);
      return data;
    },

    uploadAvatar: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await instance.post('/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return data;
    }
  },

  wallet: {
    getBalance: async () => {
      const { data } = await instance.get('/wallet/balance');
      return data;
    },

    getTransactions: async () => {
      const { data } = await instance.get('/wallet/transactions');
      return data;
    },

    withdraw: async (amount: number, address: string) => {
      const { data } = await instance.post('/wallet/withdraw', { amount, address });
      return data;
    }
  },

  training: {
    getModules: async () => {
      const { data } = await instance.get('/training/modules');
      return data;
    },

    completeModule: async (moduleId: string) => {
      const { data } = await instance.post(`/training/modules/${moduleId}/complete`);
      return data;
    },

    getProgress: async () => {
      const { data } = await instance.get('/training/progress');
      return data;
    }
  }
}; 