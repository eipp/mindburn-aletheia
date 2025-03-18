import axios from 'axios';
import { Task, TaskDetails, Worker, PaymentHistory, WithdrawalRequest, VerificationSubmission } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for auth
api.interceptors.request.use((config) => {
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const ApiService = {
  // Initialize Mini App
  async initializeMiniApp(initData: string): Promise<{ worker: Worker; authToken: string }> {
    const response = await api.post('/init', { initData });
    const { authToken } = response.data;
    localStorage.setItem('authToken', authToken);
    return response.data;
  },

  // Task Management
  async getAvailableTasks(workerId: string, limit = 10, offset = 0): Promise<{ tasks: Task[]; pagination: any }> {
    const response = await api.get('/tasks/available', { params: { workerId, limit, offset } });
    return response.data;
  },

  async getInProgressTasks(workerId: string): Promise<{ tasks: Task[] }> {
    const response = await api.get('/tasks/in-progress', { params: { workerId } });
    return response.data;
  },

  async getCompletedTasks(workerId: string, limit = 10, offset = 0): Promise<{ tasks: Task[]; pagination: any }> {
    const response = await api.get('/tasks/completed', { params: { workerId, limit, offset } });
    return response.data;
  },

  async acceptTask(workerId: string, taskId: string): Promise<TaskDetails> {
    const response = await api.post('/tasks/accept', { workerId, taskId });
    return response.data;
  },

  async submitVerification(submission: VerificationSubmission): Promise<{
    taskId: string;
    submittedAt: string;
    status: string;
    reward: number;
    newBalance: number;
    paymentStatus: string;
    qualityScore?: number;
  }> {
    const response = await api.post('/tasks/submit', submission);
    return response.data;
  },

  // Payment Management
  async getWorkerPayments(workerId: string, limit = 10, offset = 0): Promise<PaymentHistory> {
    const response = await api.get('/payments', { params: { workerId, limit, offset } });
    return response.data;
  },

  async requestWithdrawal(workerId: string, amount: number, walletAddress: string): Promise<WithdrawalRequest> {
    const response = await api.post('/payments/withdraw', { workerId, amount, walletAddress });
    return response.data;
  },

  // Error Handling Helper
  handleError(error: any): never {
    if (error.response) {
      throw {
        code: error.response.status,
        message: error.response.data.message || 'An error occurred',
        details: error.response.data.details
      };
    }
    throw {
      code: 500,
      message: 'Network error occurred',
      details: error.message
    };
  }
}; 