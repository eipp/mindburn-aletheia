import { createModelRegistry } from '../model-management/factories/create-model-registry';
import { ModelMetadata, ModelStatus, PerformanceMetrics, AuditReport } from '../model-management/types';
import { ErrorHandlingConfig } from '../model-management/config/error-handling-config';

async function main() {
  // Configure error handling with custom settings
  const errorConfigOverrides: Partial<ErrorHandlingConfig> = {
    enabled: true,
    defaultHandler: {
      name: 'default',
      enabled: true,
      severity: 'medium',
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack', 'email'],
        throttlingPeriod: 1800,
      },
    },
    globalConfig: {
      logErrors: true,
      logStackTraces: true,
      errorReporting: {
        enabled: true,
        service: 'sentry',
        environment: process.env.NODE_ENV || 'development',
        sampleRate: 1.0,
      },
      monitoring: {
        enabled: true,
        errorRateThreshold: 0.05,
        alertingEnabled: true,
      },
    },
    fallbackStrategy: {
      enabled: true,
      defaultResponse: null,
      logFallback: true,
    },
  };

  // Create model registry with error handling
  const registry = await createModelRegistry({
    errorConfigOverrides,
    registryConfigOverrides: {
      tableName: 'models-table',
      bucketName: 'models-bucket',
      region: process.env.AWS_REGION || 'us-east-1',
    },
  });

  try {
    // Example model metadata
    const modelMetadata: ModelMetadata = {
      modelId: 'example-model',
      version: '1.0.0',
      name: 'Example Model',
      type: 'classification',
      provider: 'openai',
      status: 'pending',
      trainingData: {
        source: 'synthetic',
        size: 10000,
        lastUpdated: new Date().toISOString(),
      },
      performance: {
        accuracy: 0.95,
        f1Score: 0.94,
        precision: 0.93,
        recall: 0.92,
        lastEvaluated: new Date().toISOString(),
      },
      governance: {
        approvers: ['user1'],
        lastAuditDate: new Date().toISOString(),
        complianceStatus: 'compliant',
        auditReports: [],
      },
      changelog: [],
    };

    // Register model (with automatic retries on failure)
    console.log('Registering model...');
    await registry.registerModel(modelMetadata);

    // Update model status (with error notifications)
    console.log('Updating model status...');
    await registry.updateModelStatus(
      modelMetadata.modelId,
      modelMetadata.version,
      'approved' as ModelStatus,
      'approver1'
    );

    // Update performance metrics (with error rate monitoring)
    console.log('Updating performance metrics...');
    const newMetrics: PerformanceMetrics = {
      accuracy: 0.96,
      f1Score: 0.95,
      precision: 0.94,
      recall: 0.93,
      lastEvaluated: new Date().toISOString(),
    };
    await registry.updatePerformanceMetrics(
      modelMetadata.modelId,
      modelMetadata.version,
      newMetrics
    );

    // Add changelog entry (with fallback strategy)
    console.log('Adding changelog entry...');
    await registry.addChangelogEntry(
      modelMetadata.modelId,
      modelMetadata.version,
      'Updated performance metrics',
      'user1'
    );

    // Conduct audit (with error reporting)
    console.log('Conducting audit...');
    const auditReport: AuditReport = {
      type: 'performance',
      date: new Date().toISOString(),
      auditor: 'auditor1',
      findings: [
        {
          category: 'performance',
          severity: 'low',
          description: 'Model performance meets requirements',
        },
      ],
      recommendations: [],
      status: 'passed',
    };
    await registry.conductAudit(
      modelMetadata.modelId,
      modelMetadata.version,
      auditReport
    );

    // Retrieve model (with error metrics)
    console.log('Retrieving model...');
    const retrievedModel = await registry.getModel(
      modelMetadata.modelId,
      modelMetadata.version
    );
    console.log('Retrieved model:', retrievedModel);

    // Check error metrics
    const registrationMetrics = registry.getErrorMetrics('modelRegistration');
    const deploymentMetrics = registry.getErrorMetrics('modelDeployment');
    const inferenceMetrics = registry.getErrorMetrics('modelInference');

    console.log('Error metrics:');
    console.log('- Registration:', registrationMetrics);
    console.log('- Deployment:', deploymentMetrics);
    console.log('- Inference:', inferenceMetrics);

  } catch (error) {
    console.error('Error in example:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 