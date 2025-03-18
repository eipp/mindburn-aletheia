import { FraudDetector } from '@mindburn/verification-engine/src/fraud-detection/fraudDetector';
import logger from '../utils/logger';

/**
 * Verification service for worker-webapp
 * Uses the shared fraud detection implementation
 */
export class VerificationService {
  private fraudDetector: FraudDetector;
  
  constructor() {
    this.fraudDetector = new FraudDetector();
    logger.info('Verification service initialized');
  }
  
  /**
   * Verify a task submission
   */
  async verifySubmission(params: {
    workerId: string;
    taskId: string;
    taskType: string;
    content: any;
    deviceFingerprint?: any;
    ipAddress?: string;
    processingTime: number;
  }) {
    logger.info('Verifying task submission', { taskId: params.taskId, workerId: params.workerId });
    
    try {
      const result = await this.fraudDetector.detectFraud(params);
      
      if (result.isFraudulent) {
        logger.warn('Potential fraud detected', { 
          taskId: params.taskId, 
          workerId: params.workerId,
          fraudLevel: result.fraudLevel,
          riskScore: result.riskScore,
          reasons: result.reasons
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error verifying submission', { error, taskId: params.taskId, workerId: params.workerId });
      throw error;
    }
  }
  
  /**
   * Check if a worker is in good standing
   */
  async checkWorkerStatus(workerId: string) {
    // Implementation would check worker metrics and history
    return {
      isGoodStanding: true,
      metrics: {
        accuracyScore: 0.95,
        completedTasks: 120,
        rejectionRate: 0.03
      }
    };
  }
}

// Export a singleton instance
export const verificationService = new VerificationService(); 