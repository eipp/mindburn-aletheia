// Export types from configuration
export { CoreConfig } from '../config/coreConfig';

// Health check types
export { HealthStatus, HealthCheckOptions } from '../utils/healthCheck';

// Service orchestration types
export {
  ServiceMap,
  EventHandler,
  ServiceOrchestratorOptions,
} from '../utils/serviceOrchestrator';

/**
 * Service initialization interface
 * Services that need initialization should implement this interface
 */
export interface InitializableService {
  initialize(): Promise<void>;
}

/**
 * Service shutdown interface
 * Services that need cleanup on shutdown should implement this interface
 */
export interface ShutdownableService {
  shutdown(): Promise<void>;
}

/**
 * Event types that can be emitted by the service orchestrator
 */
export enum SystemEventType {
  INITIALIZED = 'system:initialized',
  SHUTTING_DOWN = 'system:shuttingDown',
  ERROR = 'system:error',
  WARNING = 'system:warning',
}

export enum ServiceEventType {
  REGISTERED = 'service:registered',
  INITIALIZED = 'service:initialized',
  SHUTDOWN = 'service:shutdown',
  ERROR = 'service:error',
}

export enum HealthEventType {
  STATUS_CHANGED = 'health:statusChanged',
  DEGRADED = 'health:degraded',
  UNHEALTHY = 'health:unhealthy',
  RECOVERED = 'health:recovered',
}

/**
 * Core service error class
 */
export class CoreServiceError extends Error {
  public readonly serviceName: string;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    serviceName: string,
    code: string = 'UNKNOWN_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CoreServiceError';
    this.serviceName = serviceName;
    this.code = code;
    this.details = details;
  }

  /**
   * Convert the error to a loggable object
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      serviceName: this.serviceName,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
} 