import { WorkerManagementService } from '../../services/workerManagementService';
import { createLogger } from '@mindburn/shared';
import { WorkerStatus, WorkerProfile } from '../../types';
import { ApiError } from '../errors/ApiError';

export class WorkerController {
  private logger = createLogger('WorkerController');

  constructor(private workerService: WorkerManagementService) {}

  async registerWorker(data: {
    walletAddress: string;
    identityData: {
      name: string;
      documentId: string;
    };
  }): Promise<WorkerProfile> {
    try {
      this.logger.info('Registering new worker', { walletAddress: data.walletAddress });
      const worker = await this.workerService.registerWorker(data);
      this.logger.info('Worker registered successfully', { workerId: worker.id });
      return worker;
    } catch (error) {
      this.logger.error('Failed to register worker', {
        error,
        walletAddress: data.walletAddress,
      });
      throw new ApiError('Failed to register worker', 400, error);
    }
  }

  async getWorker(workerId: string): Promise<WorkerProfile | null> {
    try {
      this.logger.info('Fetching worker profile', { workerId });
      const worker = await this.workerService.getWorkerProfile(workerId);
      if (!worker) {
        this.logger.warn('Worker not found', { workerId });
        return null;
      }
      return worker;
    } catch (error) {
      this.logger.error('Failed to fetch worker profile', {
        error,
        workerId,
      });
      throw new ApiError('Failed to fetch worker profile', 500, error);
    }
  }

  async completeOnboarding(workerId: string): Promise<WorkerProfile> {
    try {
      this.logger.info('Completing worker onboarding', { workerId });
      const worker = await this.workerService.completeOnboarding(workerId);
      this.logger.info('Worker onboarding completed successfully', { workerId });
      return worker;
    } catch (error) {
      this.logger.error('Failed to complete worker onboarding', {
        error,
        workerId,
      });
      throw new ApiError('Failed to complete worker onboarding', 400, error);
    }
  }

  async updateWorkerStatus(workerId: string, status: WorkerStatus): Promise<WorkerProfile> {
    try {
      this.logger.info('Updating worker status', { workerId, status });
      const worker = await this.workerService.updateWorkerStatus(workerId, status);
      this.logger.info('Worker status updated successfully', { workerId, status });
      return worker;
    } catch (error) {
      this.logger.error('Failed to update worker status', {
        error,
        workerId,
        status,
      });
      throw new ApiError('Failed to update worker status', 400, error);
    }
  }

  async reassessWorkerSkills(workerId: string, taskType: string): Promise<WorkerProfile> {
    try {
      this.logger.info('Reassessing worker skills', { workerId, taskType });
      const worker = await this.workerService.reassessWorkerSkills(workerId, taskType);
      this.logger.info('Worker skills reassessed successfully', { workerId, taskType });
      return worker;
    } catch (error) {
      this.logger.error('Failed to reassess worker skills', {
        error,
        workerId,
        taskType,
      });
      throw new ApiError('Failed to reassess worker skills', 400, error);
    }
  }
}
