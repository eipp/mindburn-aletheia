import { DynamoDB, CloudWatch, EventBridge } from 'aws-sdk';
import { ML } from '../services/ML';
import { Redis } from '../services/Redis';
import { IpIntelligence } from '../services/IpIntelligence';
import { MetricsCollector } from './MetricsCollector';
import { MetricsPublisher } from './MetricsPublisher';
import { FraudDetector } from './FraudDetector';
import { QualityControlSystem } from './QualityControlSystem';
import { 
  ExpertiseLevel,
  TaskSubmission,
  DeviceFingerprint,
  WorkerProfile
} from './types';

// Mock AWS services
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ Item: {} }) }),
      put: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
      update: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
      query: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ Items: [] }) })
    }))
  },
  CloudWatch: jest.fn().mockImplementation(() => ({
    putMetricData: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    putMetricAlarm: jest.fn().mockReturnValue({ promise: () => Promise.resolve() })
  })),
  EventBridge: jest.fn().mockImplementation(() => ({
    putEvents: jest.fn().mockReturnValue({ promise: () => Promise.resolve() })
  }))
}));

// Mock services
const mockML = {
  calculateAccuracyScore: jest.fn().mockResolvedValue(0.85),
  calculateConsistencyScore: jest.fn().mockResolvedValue(0.75),
  calculateTimeQualityScore: jest.fn().mockResolvedValue(0.9)
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK')
};

const mockIpIntelligence = {
  checkIp: jest.fn().mockResolvedValue({
    isProxy: false,
    isDatacenter: false,
    isVpn: false,
    isTor: false,
    isMalicious: false
  })
};

const mockMetricsCollector = {
  collect: jest.fn().mockResolvedValue(undefined)
};

const mockMetricsPublisher = {
  publish: jest.fn().mockResolvedValue(undefined)
};

const mockFraudDetector = {
  detectFraud: jest.fn().mockResolvedValue({
    isFraudulent: false,
    riskScore: 0.2,
    fraudLevel: 'LOW',
    actions: [],
    signals: {
      reputation: 0.1,
      activity: 0.2,
      network: 0.1,
      quality: 0.9
    }
  })
};

describe('QualityControlSystem', () => {
  let qualityControl: QualityControlSystem;
  let mockSubmission: TaskSubmission;
  let mockDeviceFingerprint: DeviceFingerprint;
  let mockWorkerProfile: WorkerProfile;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mock data
    mockDeviceFingerprint = {
      userAgent: 'Mozilla/5.0',
      screenResolution: '1920x1080',
      colorDepth: 24,
      timezone: 'UTC',
      language: 'en-US',
      platform: 'MacIntel',
      plugins: ['PDF', 'Flash'],
      canvas: 'canvas-fingerprint',
      webgl: 'webgl-fingerprint',
      fonts: ['Arial', 'Times New Roman'],
      audio: 'audio-fingerprint',
      hardware: {
        cpuCores: 8,
        memory: 16,
        gpu: 'Intel HD Graphics'
      }
    };

    mockSubmission = {
      taskId: 'task123',
      workerId: 'worker123',
      taskType: 'text_verification',
      content: { text: 'Sample text' },
      result: { verified: true },
      confidence: 0.9,
      processingTime: 120,
      timestamp: Date.now(),
      metadata: {
        deviceFingerprint: mockDeviceFingerprint,
        ipAddress: '192.168.1.1',
        complexity: 0.5
      }
    };

    mockWorkerProfile = {
      workerId: 'worker123',
      expertiseLevel: ExpertiseLevel.INTERMEDIATE,
      accuracyScore: 0.85,
      consistencyScore: 0.8,
      speedScore: 0.75,
      peerReviewScore: 0.9,
      complexityScore: 0.7,
      tasksCompleted: 100,
      lastUpdate: Date.now()
    };

    // Initialize QualityControlSystem with mocks
    qualityControl = new QualityControlSystem(
      new DynamoDB.DocumentClient(),
      new CloudWatch(),
      new EventBridge(),
      mockML as any,
      mockRedis as any,
      mockIpIntelligence as any,
      mockMetricsCollector as any,
      mockMetricsPublisher as any,
      mockFraudDetector as any
    );
  });

  describe('evaluateSubmission', () => {
    it('should successfully evaluate a valid submission', async () => {
      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityLevel).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.metrics).toBeDefined();
      expect(mockMetricsCollector.collect).toHaveBeenCalled();
      expect(mockMetricsPublisher.publish).toHaveBeenCalled();
    });

    it('should reject fraudulent submissions', async () => {
      mockFraudDetector.detectFraud.mockResolvedValueOnce({
        isFraudulent: true,
        riskScore: 0.9,
        fraudLevel: 'HIGH',
        actions: ['RESTRICT_ACCESS'],
        signals: {
          reputation: 0.9,
          activity: 0.8,
          network: 0.9,
          quality: 0.2
        }
      });

      await expect(qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      })).rejects.toThrow('Submission rejected due to fraudulent activity');
    });

    it('should handle golden set submissions correctly', async () => {
      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: true
      });

      expect(result.metrics.accuracy).toBeGreaterThan(0);
      expect(mockML.calculateAccuracyScore).toHaveBeenCalled();
    });
  });

  describe('fraud detection', () => {
    it('should detect suspicious device fingerprints', async () => {
      mockSubmission.metadata.deviceFingerprint.canvas = '';
      mockSubmission.metadata.deviceFingerprint.webgl = '';
      mockSubmission.metadata.deviceFingerprint.plugins = [];

      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(result.qualityScore).toBeLessThan(0.8);
    });

    it('should detect suspicious IP addresses', async () => {
      mockIpIntelligence.checkIp.mockResolvedValueOnce({
        isProxy: true,
        isVpn: true,
        isTor: false,
        isMalicious: false
      });

      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(result.recommendations).toContain('INCREASE_MONITORING');
    });

    it('should detect rapid submissions', async () => {
      const rapidSubmission = { ...mockSubmission, processingTime: 1 };
      
      await expect(qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: rapidSubmission,
        isGoldenSet: false
      })).resolves.toBeDefined();

      expect(mockMetricsCollector.collect).toHaveBeenCalledWith(
        expect.objectContaining({
          fraudRisk: expect.any(Number)
        })
      );
    });
  });

  describe('worker expertise', () => {
    it('should promote workers with consistently high quality', async () => {
      mockWorkerProfile.tasksCompleted = 100;
      mockWorkerProfile.accuracyScore = 0.95;
      mockWorkerProfile.consistencyScore = 0.92;
      mockWorkerProfile.expertiseLevel = ExpertiseLevel.INTERMEDIATE;

      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(result.recommendations).toContain('PROMOTE_TO_EXPERT_REVIEWER');
    });

    it('should demote workers with poor performance', async () => {
      mockWorkerProfile.accuracyScore = 0.5;
      mockWorkerProfile.consistencyScore = 0.4;
      mockWorkerProfile.expertiseLevel = ExpertiseLevel.ADVANCED;

      const result = await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(result.recommendations).toContain('REQUIRE_ADDITIONAL_TRAINING');
    });
  });

  describe('metrics and monitoring', () => {
    it('should publish metrics for successful submissions', async () => {
      await qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      });

      expect(mockMetricsCollector.collect).toHaveBeenCalled();
      expect(mockMetricsPublisher.publish).toHaveBeenCalledWith(
        'QualityControl',
        expect.objectContaining({
          workerId: 'worker123',
          taskId: 'task123'
        })
      );
    });

    it('should emit fraud events when detected', async () => {
      mockFraudDetector.detectFraud.mockResolvedValueOnce({
        isFraudulent: true,
        riskScore: 0.9,
        fraudLevel: 'HIGH',
        actions: ['RESTRICT_ACCESS'],
        signals: { reputation: 0.9, activity: 0.8, network: 0.9, quality: 0.2 }
      });

      try {
        await qualityControl.evaluateSubmission({
          workerId: 'worker123',
          taskId: 'task123',
          submission: mockSubmission,
          isGoldenSet: false
        });
      } catch (error) {
        expect(error.message).toContain('fraudulent activity');
      }

      expect(mockMetricsPublisher.publish).toHaveBeenCalledWith(
        'QualityControl',
        expect.objectContaining({
          fraudDetection: expect.objectContaining({
            fraudLevel: 'HIGH'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle service failures gracefully', async () => {
      mockML.calculateAccuracyScore.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(qualityControl.evaluateSubmission({
        workerId: 'worker123',
        taskId: 'task123',
        submission: mockSubmission,
        isGoldenSet: false
      })).rejects.toThrow();

      expect(mockMetricsCollector.collect).not.toHaveBeenCalled();
    });

    it('should record error metrics', async () => {
      const error = new Error('Validation failed');
      mockML.calculateAccuracyScore.mockRejectedValueOnce(error);

      try {
        await qualityControl.evaluateSubmission({
          workerId: 'worker123',
          taskId: 'task123',
          submission: mockSubmission,
          isGoldenSet: false
        });
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(CloudWatch.prototype.putMetricData).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'ProcessingError'
            })
          ])
        })
      );
    });
  });

  describe('CloudWatch alarms', () => {
    it('should create monitoring alarms', async () => {
      // @ts-ignore - accessing private method for testing
      await qualityControl.createCloudWatchAlarms();

      expect(CloudWatch.prototype.putMetricAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          AlarmName: 'HighFraudDetectionRate',
          Namespace: 'Aletheia/QualityControl',
          ActionsEnabled: true
        })
      );

      expect(CloudWatch.prototype.putMetricAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          AlarmName: 'LowQualitySubmissions',
          Namespace: 'Aletheia/QualityControl',
          ActionsEnabled: true
        })
      );

      expect(CloudWatch.prototype.putMetricAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          AlarmName: 'HighErrorRate',
          Namespace: 'Aletheia/QualityControl',
          ActionsEnabled: true
        })
      );
    });
  });
}); 