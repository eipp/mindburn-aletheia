export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginId: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PluginError';

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginError);
    }

    // Attach original error stack if available
    if (originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      pluginId: this.pluginId,
      details: this.details,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}

export const PluginErrorCodes = {
  // Lifecycle Errors
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  TERMINATION_FAILED: 'TERMINATION_FAILED',
  
  // Execution Errors
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  INVALID_ARGUMENTS: 'INVALID_ARGUMENTS',
  
  // Resource Errors
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  CPU_LIMIT_EXCEEDED: 'CPU_LIMIT_EXCEEDED',
  
  // Security Errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_PERMISSION: 'INVALID_PERMISSION',
  
  // Validation Errors
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  INVALID_VERSION: 'INVALID_VERSION',
  INCOMPATIBLE_VERSION: 'INCOMPATIBLE_VERSION',
  INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
  
  // Runtime Errors
  SANDBOX_ERROR: 'SANDBOX_ERROR',
  WORKER_ERROR: 'WORKER_ERROR',
  IPC_ERROR: 'IPC_ERROR',
  
  // Plugin-specific Errors
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  ENRICHMENT_FAILED: 'ENRICHMENT_FAILED',
  VISUALIZATION_FAILED: 'VISUALIZATION_FAILED',
  INTEGRATION_FAILED: 'INTEGRATION_FAILED',
} as const;

export type PluginErrorCode = typeof PluginErrorCodes[keyof typeof PluginErrorCodes];

export class PluginErrorHandler {
  private errorListeners: Set<(error: PluginError) => void> = new Set();
  private readonly maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // Exponential backoff

  addErrorListener(listener: (error: PluginError) => void): void {
    this.errorListeners.add(listener);
  }

  removeErrorListener(listener: (error: PluginError) => void): void {
    this.errorListeners.delete(listener);
  }

  async handleError(
    error: Error | PluginError,
    context: {
      pluginId: string;
      methodName: string;
      attempt?: number;
    }
  ): Promise<never> {
    const pluginError = this.normalizeError(error, context);
    
    // Notify all error listeners
    this.errorListeners.forEach(listener => listener(pluginError));

    // Check if we should retry
    if (this.shouldRetry(pluginError, context)) {
      await this.retryOperation(context);
    }

    throw pluginError;
  }

  private normalizeError(
    error: Error | PluginError,
    context: { pluginId: string; methodName: string }
  ): PluginError {
    if (error instanceof PluginError) {
      return error;
    }

    // Convert common error types to PluginError
    if (error instanceof TypeError) {
      return new PluginError(
        error.message,
        context.pluginId,
        PluginErrorCodes.INVALID_ARGUMENTS,
        { methodName: context.methodName },
        error
      );
    }

    if (error instanceof RangeError) {
      return new PluginError(
        error.message,
        context.pluginId,
        PluginErrorCodes.EXECUTION_FAILED,
        { methodName: context.methodName },
        error
      );
    }

    // Default error conversion
    return new PluginError(
      error.message,
      context.pluginId,
      PluginErrorCodes.EXECUTION_FAILED,
      { methodName: context.methodName },
      error
    );
  }

  private shouldRetry(error: PluginError, context: { attempt?: number }): boolean {
    // Don't retry if max attempts reached
    if ((context.attempt || 0) >= this.maxRetries) {
      return false;
    }

    // Define which error codes are retryable
    const retryableCodes = new Set([
      PluginErrorCodes.EXECUTION_TIMEOUT,
      PluginErrorCodes.IPC_ERROR,
      PluginErrorCodes.WORKER_ERROR,
    ]);

    return retryableCodes.has(error.code);
  }

  private async retryOperation(context: {
    pluginId: string;
    methodName: string;
    attempt?: number;
  }): Promise<void> {
    const attempt = (context.attempt || 0) + 1;
    const delay = this.retryDelays[attempt - 1];

    await new Promise(resolve => setTimeout(resolve, delay));

    // Notify listeners about retry
    const retryError = new PluginError(
      `Retrying ${context.methodName} (attempt ${attempt}/${this.maxRetries})`,
      context.pluginId,
      'RETRY_OPERATION',
      { attempt, maxRetries: this.maxRetries }
    );

    this.errorListeners.forEach(listener => listener(retryError));
  }
} 