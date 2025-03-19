import { DynamoDB } from 'aws-sdk';
import { TonClient } from '@ton/ton';
import { Logger } from '@mindburn/shared/logger';
import { NotificationService } from '../services/notificationService';
import { WorkerManagementService } from '../services/workerManagementService';
import { WorkerOnboardingService } from '../services/workerOnboardingService';
import { WorkerSkillAssessmentService } from '../services/workerSkillAssessmentService';
import { WorkerActivityService } from '../services/workerActivityService';
import { WorkerReputationService } from '../services/workerReputationService';
import { TonWalletVerificationService } from '../services/tonWalletVerificationService';
import { IdentityVerificationService } from '../services/identityVerificationService';
import { WorkerRepository } from '../repositories/workerRepository';
import { AssessmentTaskRepository } from '../services/assessmentTaskRepository';

interface WorkerManagementConfig {
  dynamoTableName: string;
  tonEndpoint: string;
  kycApiKey: string;
  kycApiUrl: string;
  minWalletBalance: string;
  fraudDetectionEnabled: boolean;
  notificationChannels: string[];
}

export function createWorkerManagementService(
  config: WorkerManagementConfig,
  logger: Logger
): WorkerManagementService {
  // Initialize AWS DynamoDB client
  const dynamoDB = new DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    maxRetries: 3,
    retryDelayOptions: { base: 300 },
  });

  // Initialize TON client
  const tonClient = new TonClient({
    endpoint: config.tonEndpoint,
  });

  // Create repositories
  const workerRepository = new WorkerRepository(dynamoDB, config.dynamoTableName, logger);

  const assessmentTaskRepository = new AssessmentTaskRepository(logger);

  // Create notification service
  const notificationService = new NotificationService(logger, config.notificationChannels);

  // Create wallet verification service
  const walletVerificationService = new TonWalletVerificationService(
    tonClient,
    logger,
    config.minWalletBalance
  );

  // Create identity verification service
  const identityVerificationService = new IdentityVerificationService(
    logger,
    {
      apiKey: config.kycApiKey,
      apiUrl: config.kycApiUrl,
    },
    config.fraudDetectionEnabled
  );

  // Create worker activity service
  const activityService = new WorkerActivityService(logger, notificationService);

  // Create worker reputation service
  const reputationService = new WorkerReputationService(logger, notificationService);

  // Create skill assessment service
  const skillAssessmentService = new WorkerSkillAssessmentService(
    logger,
    notificationService,
    assessmentTaskRepository
  );

  // Create worker onboarding service
  const onboardingService = new WorkerOnboardingService(logger, notificationService);

  // Create and return worker management service
  return new WorkerManagementService(
    logger,
    notificationService,
    onboardingService,
    skillAssessmentService,
    activityService,
    reputationService,
    walletVerificationService,
    identityVerificationService,
    workerRepository
  );
}

// Example usage:
/*
const config: WorkerManagementConfig = {
  dynamoTableName: 'workers-table',
  tonEndpoint: 'https://ton.org/api/v1',
  kycApiKey: process.env.KYC_API_KEY!,
  kycApiUrl: 'https://api.sumsub.com',
  minWalletBalance: '0.1',
  fraudDetectionEnabled: true,
  notificationChannels: ['TELEGRAM']
};

const logger = createLogger('worker-management');
const workerManagementService = createWorkerManagementService(config, logger);
*/
