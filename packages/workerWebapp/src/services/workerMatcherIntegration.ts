import { Task, WorkerProfile } from '../types';
import { apiService } from './api';

/**
 * Service that integrates with the worker matcher functionality in the verification engine
 * to assign appropriate tasks to workers based on skills, reputation, and availability
 */
export class WorkerMatcherIntegration {
  private workerProfile: WorkerProfile | null = null;

  constructor() {
    this.loadProfile();
  }

  /**
   * Load worker profile data
   */
  private async loadProfile(): Promise<void> {
    try {
      this.workerProfile = await apiService.getProfile();
    } catch (error) {
      console.error('Failed to load worker profile:', error);
    }
  }

  /**
   * Get recommended tasks for the worker based on their profile
   */
  async getRecommendedTasks(limit = 10): Promise<Task[]> {
    try {
      if (!this.workerProfile) {
        await this.loadProfile();
      }

      const recommendedTasks = await apiService.getRecommendedTasks();
      return recommendedTasks.slice(0, limit);
    } catch (error) {
      console.error('Failed to get recommended tasks:', error);
      return [];
    }
  }

  /**
   * Get available tasks with filters
   */
  async getAvailableTasks(filters?: {
    taskTypes?: string[];
    languages?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    tasks: Task[];
    total: number;
  }> {
    try {
      // Apply defaults based on worker profile
      if (!filters) {
        filters = {};
      }

      // If task types not specified, use worker's task types
      if (!filters.taskTypes && this.workerProfile?.taskTypes) {
        filters.taskTypes = this.workerProfile.taskTypes;
      }

      // If languages not specified, use worker's languages
      if (!filters.languages && this.workerProfile?.languages) {
        filters.languages = this.workerProfile.languages;
      }

      return await apiService.getAvailableTasks(filters);
    } catch (error) {
      console.error('Failed to get available tasks:', error);
      return { tasks: [], total: 0 };
    }
  }

  /**
   * Claim a specific task for the worker
   */
  async claimTask(taskId: string): Promise<{ success: boolean; message?: string; task?: Task }> {
    try {
      const result = await apiService.claimTask(taskId);
      
      if (result.success) {
        // Fetch the full task details
        const task = await apiService.getTaskById(taskId);
        return { success: true, task };
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to claim task',
      };
    }
  }

  /**
   * Search for specific tasks
   */
  async searchTasks(query: string): Promise<Task[]> {
    try {
      return await apiService.searchTasks(query);
    } catch (error) {
      console.error('Failed to search tasks:', error);
      return [];
    }
  }

  /**
   * Skip a task
   */
  async skipTask(taskId: string, reason: string): Promise<boolean> {
    try {
      await apiService.skipTask(taskId, reason);
      return true;
    } catch (error) {
      console.error('Failed to skip task:', error);
      return false;
    }
  }
}

export const workerMatcherIntegration = new WorkerMatcherIntegration(); 