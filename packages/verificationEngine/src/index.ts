import { Task, TaskStatus } from '@mindburn/shared';

// Export fraud detection module
export * from './fraud-detection';

// Export core types
export * from './types';

// Export verification module
export * from './orchestrator/verification-orchestrator';

// Export model management utilities
export * from './model-management/model-registry';
export * from './model-management/model-versioning';
export * from './model-management/model-governance';

// Export services
export * from './services/verification-optimizer';
export * from './services/stream-processor';

// Configuration
export * from './model-management/config/model-registry-config';
export * from './model-management/config/error-handling-config';
export * from './model-management/config/monitoring-config';
export * from './model-management/config/versioning-config';
export * from './model-management/config/approval-workflow-config';

// Infrastructure
export * from './infrastructure/stacks/dashboard-stack';

// Error Handling
export * from './model-management/services/error-handler';

// Examples
export * from './examples/error-handling-example';

// Main Engine
export class VerificationEngine {
  private orchestrator: import('./orchestrator/verification-orchestrator').VerificationOrchestrator;
  private optimizer: import('./services/verification-optimizer').VerificationOptimizer;
  private streamProcessor: import('./services/stream-processor').ModelStreamProcessor;

  constructor() {
    this.orchestrator =
      new (require('./orchestrator/verification-orchestrator').VerificationOrchestrator)();
    this.optimizer = new (require('./services/verification-optimizer').VerificationOptimizer)();
    this.streamProcessor = new (require('./services/stream-processor').ModelStreamProcessor)();
  }

  async verify(
    request: import('@mindburn/shared').VerificationRequest
  ): Promise<import('@mindburn/shared').VerificationFlow> {
    return this.orchestrator.processVerificationRequest(request);
  }

  async optimize(modelId: string, version: string): Promise<void> {
    return this.optimizer.optimizeVerification(modelId, version);
  }

  async start(): Promise<void> {
    await this.streamProcessor.start();
  }

  async stop(): Promise<void> {
    await this.streamProcessor.stop();
  }
}

export const verificationEngine = new VerificationEngine();
