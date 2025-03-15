import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ErrorHandler, ErrorContext } from '../error-handler';
import { defaultConfig } from '../../config/error-handling-config';

const cloudWatchMock = mockClient(CloudWatchClient);
const snsMock = mockClient(SNSClient);

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      SLACK_SNS_TOPIC: 'slack-topic',
      EMAIL_SNS_TOPIC: 'email-topic',
      PAGERDUTY_SNS_TOPIC: 'pagerduty-topic',
      ALERTS_SNS_TOPIC: 'alerts-topic',
    };

    cloudWatchMock.reset();
    snsMock.reset();

    errorHandler = new ErrorHandler(defaultConfig);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('handleError', () => {
    it('should handle successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await errorHandler.handleError('modelRegistration', operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success');

      const result = await errorHandler.handleError('modelRegistration', operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle operation failure with retries exhausted', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);
      const context: ErrorContext = {
        modelId: 'test-model',
        operation: 'register',
      };

      await expect(errorHandler.handleError('modelRegistration', operation, context))
        .rejects.toThrow('Operation failed');

      expect(operation).toHaveBeenCalledTimes(5); // maxAttempts for modelRegistration
      expect(cloudWatchMock.calls()).toHaveLength(1);
      expect(snsMock.calls()).toHaveLength(2); // 1 for notification, 1 for alert
    });

    it('should respect notification throttling', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      // First error
      await expect(errorHandler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      // Reset mocks
      cloudWatchMock.reset();
      snsMock.reset();

      // Second error within throttling period
      await expect(errorHandler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      expect(snsMock.calls()).toHaveLength(0); // No notification sent due to throttling
    });

    it('should use fallback strategy when enabled', async () => {
      const config = {
        ...defaultConfig,
        fallbackStrategy: {
          enabled: true,
          defaultResponse: 'fallback',
          logFallback: true,
        },
      };

      const handler = new ErrorHandler(config);
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const result = await handler.handleError('modelRegistration', operation);
      expect(result).toBe('fallback');
    });

    it('should handle high error rates', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      // Trigger multiple errors to exceed threshold
      for (let i = 0; i < 10; i++) {
        await expect(errorHandler.handleError('modelRegistration', operation))
          .rejects.toThrow('Operation failed');
      }

      const alertCalls = snsMock.calls().filter(call => 
        call.args[0].input.TopicArn === process.env.ALERTS_SNS_TOPIC
      );
      expect(alertCalls.length).toBeGreaterThan(0);

      const metrics = errorHandler.getMetrics('modelRegistration');
      expect(metrics).toBeDefined();
      expect(metrics!.errorCount).toBe(10);
      expect(metrics!.errorRate).toBeGreaterThan(0);
    });

    it('should respect error reporting configuration', async () => {
      const config = {
        ...defaultConfig,
        globalConfig: {
          ...defaultConfig.globalConfig,
          errorReporting: {
            enabled: false,
            service: 'cloudwatch',
            environment: 'test',
            sampleRate: 1.0,
          },
        },
      };

      const handler = new ErrorHandler(config);
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(handler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      expect(cloudWatchMock.calls()).toHaveLength(0); // No error reporting
    });

    it('should clear metrics', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorHandler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      expect(errorHandler.getMetrics('modelRegistration')).toBeDefined();
      
      errorHandler.clearMetrics('modelRegistration');
      expect(errorHandler.getMetrics('modelRegistration')).toBeUndefined();
    });

    it('should bypass error handling when disabled', async () => {
      const config = {
        ...defaultConfig,
        enabled: false,
      };

      const handler = new ErrorHandler(config);
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(handler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
      expect(cloudWatchMock.calls()).toHaveLength(0); // No error reporting
      expect(snsMock.calls()).toHaveLength(0); // No notifications
    });

    it('should handle notification channel failures gracefully', async () => {
      snsMock.rejects(new Error('SNS failure'));

      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorHandler.handleError('modelRegistration', operation))
        .rejects.toThrow('Operation failed');

      // Should still update metrics despite notification failure
      const metrics = errorHandler.getMetrics('modelRegistration');
      expect(metrics).toBeDefined();
      expect(metrics!.errorCount).toBe(1);
    });
  });
}); 