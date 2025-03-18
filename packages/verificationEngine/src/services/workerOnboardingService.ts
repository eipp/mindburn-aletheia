import { Logger } from '@mindburn/shared/logger';
import {
  WorkerProfile,
  WorkerStatus,
  TaskType,
  WorkerLevel,
  NotificationService
} from '../types';

interface OnboardingStep {
  step: string;
  completed: boolean;
  timestamp?: string;
  metadata?: Record<string, any>;
}

interface IdentityVerification {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  method: 'TELEGRAM' | 'TON_WALLET';
  timestamp: string;
  metadata?: Record<string, any>;
}

interface WalletVerification {
  address: string;
  verified: boolean;
  balance: number;
  lastChecked: string;
}

export class WorkerOnboardingService {
  private readonly logger: Logger;
  private readonly notificationService: NotificationService;

  private readonly requiredSteps = [
    'TELEGRAM_REGISTRATION',
    'WALLET_CONNECTION',
    'IDENTITY_VERIFICATION',
    'SKILLS_ASSESSMENT',
    'GUIDELINES_ACCEPTANCE'
  ];

  constructor(
    logger: Logger,
    notificationService: NotificationService
  ) {
    this.logger = logger.child({ service: 'WorkerOnboarding' });
    this.notificationService = notificationService;
  }

  async startOnboarding(
    telegramId: string,
    language: string = 'en'
  ): Promise<WorkerProfile> {
    try {
      // Create initial worker profile
      const workerId = this.generateWorkerId();
      const worker: WorkerProfile = {
        workerId,
        status: WorkerStatus.OFFLINE,
        level: WorkerLevel.BEGINNER,
        skills: [],
        skillLevels: {},
        reputationScore: 0,
        performanceMetrics: {},
        metadata: {
          telegramId,
          language,
          onboarding: {
            started: new Date().toISOString(),
            currentStep: 'TELEGRAM_REGISTRATION',
            steps: this.initializeOnboardingSteps()
          }
        }
      };

      this.logger.info('Worker onboarding started', {
        workerId,
        telegramId
      });

      // Send welcome message
      await this.notificationService.notifyWorker(
        workerId,
        'ONBOARDING_STARTED',
        {
          nextStep: 'TELEGRAM_REGISTRATION',
          language
        }
      );

      return worker;

    } catch (error) {
      this.logger.error('Failed to start worker onboarding', {
        error,
        telegramId
      });
      throw error;
    }
  }

  async verifyTelegramRegistration(
    worker: WorkerProfile,
    telegramData: any
  ): Promise<WorkerProfile> {
    try {
      // Validate Telegram data
      if (!this.isValidTelegramData(telegramData)) {
        throw new Error('Invalid Telegram verification data');
      }

      // Update worker profile
      const updatedWorker = {
        ...worker,
        metadata: {
          ...worker.metadata,
          telegramVerification: {
            status: 'VERIFIED',
            timestamp: new Date().toISOString(),
            data: telegramData
          },
          onboarding: {
            ...worker.metadata?.onboarding,
            currentStep: 'WALLET_CONNECTION',
            steps: this.updateOnboardingStep(
              worker.metadata?.onboarding?.steps || [],
              'TELEGRAM_REGISTRATION',
              true
            )
          }
        }
      };

      this.logger.info('Telegram registration verified', {
        workerId: worker.workerId
      });

      // Send next step notification
      await this.notificationService.notifyWorker(
        worker.workerId,
        'ONBOARDING_STEP_COMPLETED',
        {
          step: 'TELEGRAM_REGISTRATION',
          nextStep: 'WALLET_CONNECTION'
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Telegram verification failed', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  async connectWallet(
    worker: WorkerProfile,
    walletAddress: string
  ): Promise<WorkerProfile> {
    try {
      // Verify wallet address format
      if (!this.isValidWalletAddress(walletAddress)) {
        throw new Error('Invalid TON wallet address');
      }

      // Verify wallet balance
      const verification = await this.verifyWalletBalance(walletAddress);

      // Update worker profile
      const updatedWorker = {
        ...worker,
        metadata: {
          ...worker.metadata,
          wallet: {
            address: walletAddress,
            verified: verification.verified,
            connectedAt: new Date().toISOString()
          },
          onboarding: {
            ...worker.metadata?.onboarding,
            currentStep: 'IDENTITY_VERIFICATION',
            steps: this.updateOnboardingStep(
              worker.metadata?.onboarding?.steps || [],
              'WALLET_CONNECTION',
              true
            )
          }
        }
      };

      this.logger.info('Wallet connected', {
        workerId: worker.workerId,
        walletAddress
      });

      // Send next step notification
      await this.notificationService.notifyWorker(
        worker.workerId,
        'ONBOARDING_STEP_COMPLETED',
        {
          step: 'WALLET_CONNECTION',
          nextStep: 'IDENTITY_VERIFICATION'
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Wallet connection failed', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  async verifyIdentity(
    worker: WorkerProfile,
    verificationData: any
  ): Promise<WorkerProfile> {
    try {
      // Perform identity verification
      const verification = await this.performIdentityVerification(verificationData);

      // Update worker profile
      const updatedWorker = {
        ...worker,
        metadata: {
          ...worker.metadata,
          identityVerification: verification,
          onboarding: {
            ...worker.metadata?.onboarding,
            currentStep: 'SKILLS_ASSESSMENT',
            steps: this.updateOnboardingStep(
              worker.metadata?.onboarding?.steps || [],
              'IDENTITY_VERIFICATION',
              true
            )
          }
        }
      };

      this.logger.info('Identity verified', {
        workerId: worker.workerId,
        method: verification.method
      });

      // Send next step notification
      await this.notificationService.notifyWorker(
        worker.workerId,
        'ONBOARDING_STEP_COMPLETED',
        {
          step: 'IDENTITY_VERIFICATION',
          nextStep: 'SKILLS_ASSESSMENT'
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Identity verification failed', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  async assessSkills(
    worker: WorkerProfile,
    skillAssessments: Record<TaskType, number>
  ): Promise<WorkerProfile> {
    try {
      // Validate and process skill assessments
      const validatedSkills = this.validateSkillAssessments(skillAssessments);

      // Update worker profile
      const updatedWorker = {
        ...worker,
        skills: Object.keys(validatedSkills) as TaskType[],
        skillLevels: validatedSkills,
        metadata: {
          ...worker.metadata,
          onboarding: {
            ...worker.metadata?.onboarding,
            currentStep: 'GUIDELINES_ACCEPTANCE',
            steps: this.updateOnboardingStep(
              worker.metadata?.onboarding?.steps || [],
              'SKILLS_ASSESSMENT',
              true
            )
          }
        }
      };

      this.logger.info('Skills assessed', {
        workerId: worker.workerId,
        skills: validatedSkills
      });

      // Send next step notification
      await this.notificationService.notifyWorker(
        worker.workerId,
        'ONBOARDING_STEP_COMPLETED',
        {
          step: 'SKILLS_ASSESSMENT',
          nextStep: 'GUIDELINES_ACCEPTANCE'
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Skills assessment failed', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  async acceptGuidelines(
    worker: WorkerProfile,
    acceptance: {
      accepted: boolean;
      timestamp: string;
      version: string;
    }
  ): Promise<WorkerProfile> {
    try {
      if (!acceptance.accepted) {
        throw new Error('Guidelines must be accepted to complete onboarding');
      }

      // Update worker profile
      const updatedWorker = {
        ...worker,
        status: WorkerStatus.AVAILABLE,
        metadata: {
          ...worker.metadata,
          guidelinesAcceptance: acceptance,
          onboarding: {
            ...worker.metadata?.onboarding,
            completed: new Date().toISOString(),
            steps: this.updateOnboardingStep(
              worker.metadata?.onboarding?.steps || [],
              'GUIDELINES_ACCEPTANCE',
              true
            )
          }
        }
      };

      this.logger.info('Onboarding completed', {
        workerId: worker.workerId
      });

      // Send completion notification
      await this.notificationService.notifyWorker(
        worker.workerId,
        'ONBOARDING_COMPLETED',
        {
          skills: updatedWorker.skills,
          status: updatedWorker.status
        }
      );

      return updatedWorker;

    } catch (error) {
      this.logger.error('Guidelines acceptance failed', {
        error,
        workerId: worker.workerId
      });
      throw error;
    }
  }

  private generateWorkerId(): string {
    return `W${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeOnboardingSteps(): OnboardingStep[] {
    return this.requiredSteps.map(step => ({
      step,
      completed: false,
      timestamp: new Date().toISOString()
    }));
  }

  private updateOnboardingStep(
    steps: OnboardingStep[],
    stepName: string,
    completed: boolean
  ): OnboardingStep[] {
    return steps.map(step => 
      step.step === stepName
        ? { ...step, completed, timestamp: new Date().toISOString() }
        : step
    );
  }

  private isValidTelegramData(data: any): boolean {
    // TODO: Implement Telegram data validation
    return true;
  }

  private isValidWalletAddress(address: string): boolean {
    // TODO: Implement TON wallet address validation
    return true;
  }

  private async verifyWalletBalance(
    address: string
  ): Promise<WalletVerification> {
    // TODO: Implement TON wallet balance verification
    return {
      address,
      verified: true,
      balance: 0,
      lastChecked: new Date().toISOString()
    };
  }

  private async performIdentityVerification(
    data: any
  ): Promise<IdentityVerification> {
    // TODO: Implement identity verification logic
    return {
      status: 'VERIFIED',
      method: 'TELEGRAM',
      timestamp: new Date().toISOString()
    };
  }

  private validateSkillAssessments(
    assessments: Record<TaskType, number>
  ): Record<TaskType, number> {
    const validated: Record<TaskType, number> = {};

    Object.entries(assessments).forEach(([task, score]) => {
      if (score >= 0 && score <= 100) {
        validated[task as TaskType] = score;
      }
    });

    return validated;
  }
} 