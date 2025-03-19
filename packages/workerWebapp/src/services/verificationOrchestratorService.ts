import { apiService } from './api';
import { HumanVerificationSubmission, VerificationTask, VerificationResult } from '../types';

/**
 * Service to interact with the Verification Orchestrator
 */
export const verificationOrchestratorService = {
  /**
   * Fetch tasks that need human verification
   */
  async fetchVerificationTasks(): Promise<VerificationTask[]> {
    try {
      const response = await apiService.get('/verification/tasks/pending');
      return response.data;
    } catch (error) {
      console.error('Error fetching verification tasks:', error);
      throw error;
    }
  },

  /**
   * Claim a verification task for the current worker
   */
  async claimVerificationTask(taskId: string): Promise<{ success: boolean; task?: VerificationTask; message?: string }> {
    try {
      const response = await apiService.post(`/verification/tasks/${taskId}/claim`);
      
      if (response.success) {
        return {
          success: true,
          task: response.data
        };
      } else {
        return {
          success: false,
          message: response.message || 'Failed to claim verification task'
        };
      }
    } catch (error) {
      console.error('Error claiming verification task:', error);
      return {
        success: false,
        message: error.message || 'Error claiming task'
      };
    }
  },

  /**
   * Skip a verification task (release it back to the queue)
   */
  async skipVerificationTask(taskId: string, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiService.post(`/verification/tasks/${taskId}/skip`, { reason });
      return {
        success: response.success,
        message: response.message
      };
    } catch (error) {
      console.error('Error skipping verification task:', error);
      return {
        success: false,
        message: error.message || 'Error skipping task'
      };
    }
  },

  /**
   * Submit human verification result
   */
  async submitVerification(verification: HumanVerificationSubmission): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiService.post(`/verification/flows/${verification.flowId}/human-verification`, verification);
      
      return {
        success: response.success,
        message: response.message || 'Verification submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting verification:', error);
      return {
        success: false,
        message: error.message || 'Error submitting verification'
      };
    }
  },

  /**
   * Get verification history for the current worker
   */
  async getVerificationHistory(limit: number = 10): Promise<VerificationTask[]> {
    try {
      const response = await apiService.get('/verification/history', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching verification history:', error);
      throw error;
    }
  },

  /**
   * Get detailed information about a specific verification flow
   */
  async getVerificationFlow(flowId: string): Promise<{
    flow: {
      id: string;
      status: string;
      request: any;
      aiResult: VerificationResult;
      humanVerification?: any;
      createdAt: string;
      completedAt?: string;
    };
    success: boolean;
  }> {
    try {
      const response = await apiService.get(`/verification/flows/${flowId}`);
      return {
        flow: response.data,
        success: true
      };
    } catch (error) {
      console.error('Error fetching verification flow:', error);
      throw error;
    }
  }
}; 