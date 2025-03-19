import { VerificationEngine } from '@/verification/VerificationEngine';
import { VerificationStrategy } from '@/verification/types';
import { dynamoMock } from '../../setup/unit';

describe('VerificationEngine', () => {
  let verificationEngine: VerificationEngine;

  beforeEach(() => {
    verificationEngine = new VerificationEngine();
  });

  describe('selectStrategy', () => {
    it('should select AI strategy for simple text verification', async () => {
      const task = {
        id: 'task1',
        type: 'text_verification',
        content: 'Simple text to verify',
        complexity: 'low',
      };

      const strategy = await verificationEngine.selectStrategy(task);
      expect(strategy).toBe(VerificationStrategy.AI);
    });

    it('should select human consensus for complex tasks', async () => {
      const task = {
        id: 'task2',
        type: 'image_verification',
        content: 'https://example.com/complex-image.jpg',
        complexity: 'high',
      };

      const strategy = await verificationEngine.selectStrategy(task);
      expect(strategy).toBe(VerificationStrategy.HUMAN_CONSENSUS);
    });
  });

  describe('verify', () => {
    it('should successfully verify task with AI strategy', async () => {
      const task = {
        id: 'task3',
        type: 'text_verification',
        content: 'Content to verify',
      };

      const result = await verificationEngine.verify(task, VerificationStrategy.AI);

      expect(result).toEqual({
        taskId: 'task3',
        decision: 'APPROVED',
        confidence: expect.any(Number),
        explanation: expect.any(String),
      });
    });

    it('should handle verification failures gracefully', async () => {
      const task = {
        id: 'task4',
        type: 'invalid_type',
        content: 'Invalid content',
      };

      await expect(verificationEngine.verify(task, VerificationStrategy.AI)).rejects.toThrow(
        'Unsupported verification type'
      );
    });
  });

  describe('caching', () => {
    it('should cache verification results', async () => {
      const task = {
        id: 'task5',
        type: 'text_verification',
        content: 'Cache test content',
      };

      // First verification
      const result1 = await verificationEngine.verify(task, VerificationStrategy.AI);

      // Second verification should use cache
      const result2 = await verificationEngine.verify(task, VerificationStrategy.AI);

      expect(result1).toEqual(result2);
      // Verify cache was used
      expect(dynamoMock).toHaveReceivedCommandTimes('GetItem', 1);
    });
  });

  describe('fraud detection', () => {
    it('should detect suspicious patterns', async () => {
      const suspiciousTask = {
        id: 'task6',
        type: 'text_verification',
        content: 'Suspicious content',
        workerId: 'worker1',
        metadata: {
          ipAddress: '1.1.1.1',
          completionTime: 100, // Suspiciously fast
        },
      };

      const result = await verificationEngine.verify(
        suspiciousTask,
        VerificationStrategy.HUMAN_CONSENSUS
      );

      expect(result.riskScore).toBeGreaterThan(0.7);
      expect(result.flags).toContain('SUSPICIOUS_COMPLETION_TIME');
    });
  });
});
