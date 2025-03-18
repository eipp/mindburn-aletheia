import { Logger } from '@mindburn/shared/logger';
import {
  WorkerProfile,
  WorkerStatus,
  TaskType,
  NotificationType,
  NotificationService,
} from '../types';
import { WorkerOnboardingService } from './workerOnboardingService';
import { WorkerSkillAssessmentService } from './workerSkillAssessmentService';
import { WorkerActivityService } from './workerActivityService';
import { WorkerReputationService } from './workerReputationService';
import { TonWalletVerificationService } from './tonWalletVerificationService';
import { IdentityVerificationService } from './identityVerificationService';
import { WorkerRepository } from '../repositories/workerRepository';

export class WorkerManagementService {
  private readonly logger: Logger;
  private readonly notificationService: NotificationService;
  private readonly onboardingService: WorkerOnboardingService;
  private readonly skillAssessmentService: WorkerSkillAssessmentService;
  private readonly activityService: WorkerActivityService;
  private readonly reputationService: WorkerReputationService;
  private readonly walletVerificationService: TonWalletVerificationService;
  private readonly identityVerificationService: IdentityVerificationService;
  private readonly workerRepository: WorkerRepository;

  constructor(
    logger: Logger,
    notificationService: NotificationService,
    onboardingService: WorkerOnboardingService,
    skillAssessmentService: WorkerSkillAssessmentService,
    activityService: WorkerActivityService,
    reputationService: WorkerReputationService,
    walletVerificationService: TonWalletVerificationService,
    identityVerificationService: IdentityVerificationService,
    workerRepository: WorkerRepository
  ) {
    this.logger = logger.child({ service: 'WorkerManagement' });
    this.notificationService = notificationService;
    this.onboardingService = onboardingService;
    this.skillAssessmentService = skillAssessmentService;
    this.activityService = activityService;
    this.reputationService = reputationService;
    this.walletVerificationService = walletVerificationService;
    this.identityVerificationService = identityVerificationService;
    this.workerRepository = workerRepository;
  }

  async registerWorker(telegramId: string, language: string = 'en'): Promise<WorkerProfile> {
    try {
      // Start onboarding process
      const worker = await this.onboardingService.startOnboarding(telegramId, language);

      // Create worker profile in database
      const createdWorker = await this.workerRepository.createWorker(worker);

      this.logger.info('Worker registration started', {
        workerId: worker.workerId,
        telegramId,
      });

      // Send welcome notification
      await this.notificationService.sendNotification({
        type: NotificationType.ONBOARDING_STARTED,
        recipient: telegramId,
        data: {
          workerId: worker.workerId,
          language,
        },
      });

      return createdWorker;
    } catch (error) {
      this.logger.error('Worker registration failed', {
        error,
        telegramId,
      });
      throw error;
    }
  }

  async completeOnboarding(
    worker: WorkerProfile,
    onboardingData: {
      telegramData: any;
      walletAddress: string;
      identityData: any;
      guidelinesAcceptance: {
        accepted: boolean;
        timestamp: string;
        version: string;
      };
    }
  ): Promise<WorkerProfile> {
    try {
      // Verify Telegram registration
      let updatedWorker = await this.onboardingService.verifyTelegramRegistration(
        worker,
        onboardingData.telegramData
      );

      // Verify wallet
      const walletVerification = await this.walletVerificationService.verifyWallet(
        onboardingData.walletAddress
      );

      if (!walletVerification.verified) {
        throw new Error('Wallet verification failed');
      }

      updatedWorker = await this.onboardingService.connectWallet(
        updatedWorker,
        onboardingData.walletAddress
      );

      // Verify identity
      const identityVerification = await this.identityVerificationService.verifyIdentity(
        worker.workerId,
        onboardingData.identityData
      );

      if (identityVerification.status !== 'VERIFIED') {
        throw new Error('Identity verification failed');
      }

      updatedWorker = await this.onboardingService.verifyIdentity(
        updatedWorker,
        onboardingData.identityData
      );

      // Perform initial skill assessment
      const assessmentResults = await this.skillAssessmentService.assessAllSkills(updatedWorker);

      updatedWorker = await this.skillAssessmentService.updateWorkerSkills(
        updatedWorker,
        assessmentResults
      );

      // Accept guidelines and complete onboarding
      updatedWorker = await this.onboardingService.acceptGuidelines(
        updatedWorker,
        onboardingData.guidelinesAcceptance
      );

      // Update worker profile in database
      updatedWorker = await this.workerRepository.updateWorkerProfile(updatedWorker);

      // Start monitoring wallet activity
      await this.walletVerificationService.monitorWalletActivity(
        onboardingData.walletAddress,
        async activity => {
          await this.handleWalletActivity(updatedWorker.workerId, activity);
        }
      );

      this.logger.info('Worker onboarding completed', {
        workerId: worker.workerId,
        skills: updatedWorker.skills,
        level: updatedWorker.level,
      });

      // Send completion notification
      await this.notificationService.sendNotification({
        type: NotificationType.ONBOARDING_COMPLETED,
        recipient: updatedWorker.telegramId,
        data: {
          workerId: updatedWorker.workerId,
          skills: updatedWorker.skills,
          level: updatedWorker.level,
        },
      });

      return updatedWorker;
    } catch (error) {
      this.logger.error('Worker onboarding completion failed', {
        error,
        workerId: worker.workerId,
      });
      throw error;
    }
  }

  async updateWorkerStatus(
    workerId: string,
    newStatus: WorkerStatus,
    reason?: string
  ): Promise<WorkerProfile> {
    try {
      const worker = await this.getWorkerProfile(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      // Update activity status
      const updatedWorker = await this.activityService.updateWorkerStatus(
        worker,
        newStatus,
        reason
      );

      // Update status in database
      await this.workerRepository.updateWorkerStatus(workerId, newStatus, reason);

      this.logger.info('Worker status updated', {
        workerId: worker.workerId,
        oldStatus: worker.status,
        newStatus,
        reason,
      });

      // Send status update notification
      await this.notificationService.sendNotification({
        type: NotificationType.STATUS_CHANGE,
        recipient: worker.telegramId,
        data: {
          workerId,
          oldStatus: worker.status,
          newStatus,
          reason,
        },
      });

      return updatedWorker;
    } catch (error) {
      this.logger.error('Worker status update failed', {
        error,
        workerId,
        newStatus,
      });
      throw error;
    }
  }

  async reassessWorkerSkills(workerId: string, taskTypes?: TaskType[]): Promise<WorkerProfile> {
    try {
      const worker = await this.getWorkerProfile(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      const typesToAssess = taskTypes || worker.skills;
      const assessmentResults: Record<TaskType, any> = {};

      // Assess specified skills
      for (const taskType of typesToAssess) {
        assessmentResults[taskType] = await this.skillAssessmentService.assessSkill(
          worker,
          taskType
        );
      }

      // Update worker profile with new skill levels
      const updatedWorker = await this.skillAssessmentService.updateWorkerSkills(
        worker,
        assessmentResults
      );

      // Update skills in database
      await this.workerRepository.updateWorkerSkills(workerId, assessmentResults);

      this.logger.info('Worker skills reassessed', {
        workerId: worker.workerId,
        assessedSkills: typesToAssess,
        newLevel: updatedWorker.level,
      });

      return updatedWorker;
    } catch (error) {
      this.logger.error('Worker skill reassessment failed', {
        error,
        workerId,
        taskTypes,
      });
      throw error;
    }
  }

  async updateWorkerReputation(workerId: string, taskResults: any[]): Promise<WorkerProfile> {
    try {
      const worker = await this.getWorkerProfile(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      // Update reputation based on task results
      const updatedWorker = await this.reputationService.updateWorkerReputation(
        worker,
        taskResults
      );

      // Update worker profile in database
      await this.workerRepository.updateWorkerProfile(updatedWorker);

      this.logger.info('Worker reputation updated', {
        workerId: worker.workerId,
        newScore: updatedWorker.reputationScore,
      });

      return updatedWorker;
    } catch (error) {
      this.logger.error('Worker reputation update failed', {
        error,
        workerId,
      });
      throw error;
    }
  }

  async getWorkerStats(workerId: string): Promise<{
    profile: WorkerProfile;
    activityMetrics: any;
    reputationStats: any;
  }> {
    try {
      const worker = await this.getWorkerProfile(workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      // Get worker activity metrics
      const activityMetrics = await this.activityService.getWorkerActivity(workerId);

      // Get worker reputation stats
      const reputationStats = await this.reputationService.getWorkerStatistics(workerId);

      this.logger.info('Worker stats retrieved', {
        workerId,
      });

      return {
        profile: worker,
        activityMetrics,
        reputationStats,
      };
    } catch (error) {
      this.logger.error('Failed to get worker stats', {
        error,
        workerId,
      });
      throw error;
    }
  }

  private async getWorkerProfile(workerId: string): Promise<WorkerProfile> {
    const worker = await this.workerRepository.getWorkerById(workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    return worker;
  }

  private async handleWalletActivity(workerId: string, activity: any): Promise<void> {
    try {
      // Process wallet activity and update worker metrics if needed
      this.logger.info('Processing wallet activity', {
        workerId,
        activityType: activity.type,
      });

      // Update activity metrics
      const worker = await this.getWorkerProfile(workerId);
      const updatedMetrics = {
        ...worker.activityMetrics,
        lastWalletActivity: activity.timestamp,
        totalTransactions: (worker.activityMetrics?.totalTransactions || 0) + 1,
      };

      await this.workerRepository.updateWorkerActivityMetrics(workerId, updatedMetrics);
    } catch (error) {
      this.logger.error('Failed to handle wallet activity', {
        error,
        workerId,
        activity,
      });
    }
  }
}
