import { ErrorHandler, ErrorContext } from './error-handler';
import { ModelRegistry } from '../model-registry';
import { ModelMetadata, ModelStatus, PerformanceMetrics, AuditReport } from '../types';
import { ErrorHandlingConfig } from '../config/error-handling-config';

export class ModelRegistryWithErrorHandling {
  private errorHandler: ErrorHandler;
  private modelRegistry: ModelRegistry;

  constructor(errorHandlingConfig: ErrorHandlingConfig, modelRegistry: ModelRegistry) {
    this.errorHandler = new ErrorHandler(errorHandlingConfig);
    this.modelRegistry = modelRegistry;
  }

  private createErrorContext(modelId: string, operation: string, metadata?: Record<string, any>): ErrorContext {
    return {
      modelId,
      operation,
      timestamp: new Date(),
      metadata,
    };
  }

  public async registerModel(modelMetadata: ModelMetadata): Promise<void> {
    const context = this.createErrorContext(modelMetadata.modelId, 'registerModel', {
      version: modelMetadata.version,
      name: modelMetadata.name,
    });

    await this.errorHandler.handleError(
      'modelRegistration',
      async () => this.modelRegistry.registerModel(modelMetadata),
      context
    );
  }

  public async updateModelStatus(
    modelId: string,
    version: string,
    status: ModelStatus,
    approver: string
  ): Promise<void> {
    const context = this.createErrorContext(modelId, 'updateModelStatus', {
      version,
      status,
      approver,
    });

    await this.errorHandler.handleError(
      'modelDeployment',
      async () => this.modelRegistry.updateModelStatus(modelId, version, status, approver),
      context
    );
  }

  public async updatePerformanceMetrics(
    modelId: string,
    version: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const context = this.createErrorContext(modelId, 'updatePerformanceMetrics', {
      version,
      metrics,
    });

    await this.errorHandler.handleError(
      'modelInference',
      async () => this.modelRegistry.updatePerformanceMetrics(modelId, version, metrics),
      context
    );
  }

  public async addChangelogEntry(
    modelId: string,
    version: string,
    entry: string,
    author: string
  ): Promise<void> {
    const context = this.createErrorContext(modelId, 'addChangelogEntry', {
      version,
      author,
    });

    await this.errorHandler.handleError(
      'modelRegistration',
      async () => this.modelRegistry.addChangelogEntry(modelId, version, entry, author),
      context
    );
  }

  public async conductAudit(
    modelId: string,
    version: string,
    auditReport: AuditReport
  ): Promise<void> {
    const context = this.createErrorContext(modelId, 'conductAudit', {
      version,
      auditType: auditReport.type,
    });

    await this.errorHandler.handleError(
      'modelRegistration',
      async () => this.modelRegistry.conductAudit(modelId, version, auditReport),
      context
    );
  }

  public async getModel(modelId: string, version: string): Promise<ModelMetadata> {
    const context = this.createErrorContext(modelId, 'getModel', { version });

    return this.errorHandler.handleError(
      'modelInference',
      async () => this.modelRegistry.getModel(modelId, version),
      context
    );
  }

  public getErrorMetrics(operation: string): ErrorMetrics | undefined {
    return this.errorHandler.getMetrics(operation);
  }

  public clearErrorMetrics(operation: string): void {
    this.errorHandler.clearMetrics(operation);
  }
}