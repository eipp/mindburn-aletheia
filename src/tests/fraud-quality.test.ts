import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AdvancedFraudDetector } from '../verification/AdvancedFraudDetector';
import { QualityControlSystem } from '../verification/QualityControlSystem';
import { ServiceOrchestrator } from '../services/ServiceOrchestrator';
import { ML } from '../services/ML';
import { IpIntelligence } from '../services/IpIntelligence';
import { FraudQualityConfig } from '../config/FraudQualityConfig';

// Mock external services
jest.mock('../services/ML');
jest.mock('../services/IpIntelligence');

describe('Fraud Detection and Quality Control System', () => {
  let fraudDetector: AdvancedFraudDetector;
  let qualityControl: QualityControlSystem;
  let orchestrator: ServiceOrchestrator;
  let config: FraudQualityConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize components
    fraudDetector = new AdvancedFraudDetector();
    qualityControl = new QualityControlSystem();
    orchestrator = new ServiceOrchestrator();
    config = FraudQualityConfig.getInstance();
  });

  describe('Fraud Detection', () => {
    test('should detect high-risk activity patterns', async () => {
      const submission = {
        taskId: 'task123',
        workerId: 'worker123',
        taskType: 'verification',
        content: { text: 'test content' },
        result: { label: 'approved' },
        confidence: 0.9,
        processingTime: 2, // Suspiciously fast
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        deviceFingerprint: {
          userAgent: 'test-agent',
          screenResolution: '1920x1080',
          colorDepth: 24,
          timezone: 'UTC',
          language: 'en-US',
          platform: 'Win32',
          plugins: [],
          canvas: 'hash123',
          webgl: 'hash456',
          fonts: [],
          audio: 'hash789'
        }
      };

      const result = await fraudDetector.detectFraud(submission);

      expect(result.isFraudulent).toBe(true);
      expect(result.riskScore).toBeGreaterThan(0.8);
      expect(result.fraudLevel).toBe('HIGH');
    });

    test('should detect IP-based fraud signals', async () => {
      const ipIntelligence = new IpIntelligence();
      const riskScore = await ipIntelligence.assessIpRisk('192.168.1.1');

      expect(riskScore).toBeGreaterThan(0.7);
    });

    test('should detect device fingerprint anomalies', async () => {
      const submissions = [
        {
          workerId: 'worker123',
          deviceFingerprint: { userAgent: 'agent1' }
        },
        {
          workerId: 'worker123',
          deviceFingerprint: { userAgent: 'agent2' }
        }
      ];

      const results = await Promise.all(
        submissions.map(s => fraudDetector.detectFraud(s))
      );

      expect(results[1].signals).toContain('DEVICE_MISMATCH');
    });
  });

  describe('Quality Control', () => {
    test('should evaluate golden set accuracy', async () => {
      const submission = {
        taskId: 'golden123',
        workerId: 'worker123',
        result: { label: 'approved' },
        isGoldenSet: true,
        expectedResult: { label: 'approved' }
      };

      const result = await qualityControl.evaluateSubmission(submission);

      expect(result.qualityScore).toBeGreaterThan(0.9);
    });

    test('should detect consistency issues', async () => {
      const submissions = [
        {
          taskId: 'task1',
          workerId: 'worker123',
          result: { label: 'approved' }
        },
        {
          taskId: 'task2',
          workerId: 'worker123',
          result: { label: 'rejected' }
        },
        {
          taskId: 'task1',
          workerId: 'worker123',
          result: { label: 'rejected' }
        }
      ];

      const results = await Promise.all(
        submissions.map(s => qualityControl.evaluateSubmission(s))
      );

      expect(results[2].metrics.consistencyScore).toBeLessThan(0.5);
    });

    test('should evaluate time-based quality', async () => {
      const submission = {
        taskId: 'task123',
        workerId: 'worker123',
        processingTime: 300, // Too long
        expectedProcessingTime: 60
      };

      const result = await qualityControl.evaluateSubmission(submission);

      expect(result.metrics.timeQualityScore).toBeLessThan(0.6);
    });
  });

  describe('Service Orchestrator', () => {
    test('should handle submission processing end-to-end', async () => {
      const submission = {
        taskId: 'task123',
        workerId: 'worker123',
        taskType: 'verification',
        content: { text: 'test content' },
        result: { label: 'approved' },
        confidence: 0.9,
        processingTime: 30,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        deviceFingerprint: {
          userAgent: 'test-agent'
        }
      };

      const result = await orchestrator.processSubmission(submission);

      expect(result).toHaveProperty('fraudResult');
      expect(result).toHaveProperty('qualityResult');
      expect(result.fraudResult.riskScore).toBeDefined();
      expect(result.qualityResult.qualityScore).toBeDefined();
    });

    test('should handle service failures gracefully', async () => {
      // Mock ML service failure
      (ML as jest.Mock).mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const submission = {
        taskId: 'task123',
        workerId: 'worker123'
      };

      await expect(orchestrator.processSubmission(submission))
        .resolves
        .toHaveProperty('fraudResult');
    });
  });

  describe('Configuration', () => {
    test('should load feature flags correctly', () => {
      expect(config.isFeatureEnabled('enableAdvancedFraudDetection')).toBe(true);
      expect(config.isFeatureEnabled('enableMachineLearning')).toBe(true);
    });

    test('should apply correct thresholds', () => {
      const fraudHighRisk = config.getThreshold('fraud', 'highRisk');
      expect(fraudHighRisk).toBe(0.6);

      const qualityMinScore = config.getThreshold('quality', 'minimumScore');
      expect(qualityMinScore).toBe(0.7);
    });

    test('should handle invalid configuration gracefully', () => {
      process.env.FRAUD_HIGH_RISK = 'invalid';
      config.reloadConfig();

      const fraudHighRisk = config.getThreshold('fraud', 'highRisk');
      expect(fraudHighRisk).toBe(0.6); // Default value
    });
  });
}); 