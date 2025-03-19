import { ModelErrorHandler } from '../model-management/services/error-handler';
import { ErrorHandlingConfig } from '../model-management/config/error-handling-config';

// Example configuration
const config: ErrorHandlingConfig = {
  enabled: true,
  defaultHandler: {
    name: 'default',
    enabled: true,
    severity: 'high',
    retryConfig: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelayMs: 1000,
    },
  },
  handlers: {
    modelValidation: {
      name: 'modelValidation',
      enabled: true,
      severity: 'medium',
      retryConfig: {
        maxAttempts: 2,
        backoffMultiplier: 1.5,
        initialDelayMs: 500,
      },
    },
  },
  globalConfig: {
    logErrors: true,
    logStackTraces: true,
    monitoring: {
      enabled: true,
      alertingEnabled: true,
      errorRateThreshold: 0.1,
    },
  },
  fallbackStrategy: {
    enabled: true,
    logFallback: true,
    defaultResponse: null,
  },
};

// Example usage
async function main() {
  const errorHandler = new ModelErrorHandler(config);

  try {
    // Example 1: Handling a critical error
    try {
      throw new Error('Critical model validation error');
    } catch (error) {
      await errorHandler.handleError(error as Error, {
        modelId: 'model-123',
        severity: 'high',
        operation: 'validation',
      });
    }

    // Example 2: Handling a non-critical error
    try {
      throw new Error('Minor processing warning');
    } catch (error) {
      await errorHandler.handleWarning('Minor processing issue', {
        modelId: 'model-123',
        operation: 'processing',
      });
    }

    // Example 3: Handling multiple errors
    const errors = [
      new Error('Validation error 1'),
      new Error('Validation error 2'),
      new Error('Validation error 3'),
    ];

    await Promise.all(
      errors.map(error =>
        errorHandler.handleError(error, {
          modelId: 'model-123',
          severity: 'medium',
          operation: 'batch-validation',
        })
      )
    );
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the example
main().catch(console.error);
