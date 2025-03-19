import { EventEmitter } from 'events';
import {
  ILogger,
  createLogger,
  DynamoDBService,
  TonService,
  VerificationService
} from '@mindburn/shared';

export interface ServiceMap {
  [key: string]: any;
}

export type EventHandler = (...args: any[]) => void | Promise<void>;

export interface ServiceOrchestratorOptions {
  logger?: ILogger;
  services?: ServiceMap;
}

/**
 * Service Orchestrator for managing inter-package communication
 * 
 * This class provides:
 * 1. Service registration and retrieval
 * 2. Event-based communication between packages
 * 3. Dependency management and service lifecycle
 */
export class ServiceOrchestrator {
  private services: ServiceMap;
  private eventEmitter: EventEmitter;
  private logger: ILogger;
  private isInitialized: boolean = false;

  constructor(options: ServiceOrchestratorOptions = {}) {
    this.services = options.services || {};
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger || createLogger({ service: 'service-orchestrator' });
    
    // Set max listeners to a higher value to support many inter-service communications
    this.eventEmitter.setMaxListeners(50);
  }

  /**
   * Initialize the orchestrator and its services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Service orchestrator is already initialized');
      return;
    }

    this.logger.info('Initializing service orchestrator');
    
    // Perform initialization logic for registered services
    for (const [serviceName, service] of Object.entries(this.services)) {
      if (typeof service.initialize === 'function') {
        try {
          this.logger.debug(`Initializing service: ${serviceName}`);
          await service.initialize();
        } catch (error) {
          this.logger.error(`Failed to initialize service: ${serviceName}`, { error });
          throw new Error(`Service initialization failed: ${serviceName}`);
        }
      }
    }

    this.isInitialized = true;
    this.logger.info('Service orchestrator initialized successfully');
    this.emit('system:initialized', { timestamp: new Date().toISOString() });
  }

  /**
   * Shutdown the orchestrator and its services
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Service orchestrator is not initialized');
      return;
    }

    this.logger.info('Shutting down service orchestrator');
    
    // Emit shutdown event before shutting down services
    this.emit('system:shuttingDown', { timestamp: new Date().toISOString() });
    
    // Perform shutdown logic for registered services in reverse order
    const serviceEntries = Object.entries(this.services).reverse();
    
    for (const [serviceName, service] of serviceEntries) {
      if (typeof service.shutdown === 'function') {
        try {
          this.logger.debug(`Shutting down service: ${serviceName}`);
          await service.shutdown();
        } catch (error) {
          this.logger.error(`Failed to shut down service: ${serviceName}`, { error });
          // Continue shutting down other services even if one fails
        }
      }
    }
    
    // Remove all event listeners
    this.eventEmitter.removeAllListeners();
    
    this.isInitialized = false;
    this.logger.info('Service orchestrator shut down successfully');
  }

  /**
   * Register a service with the orchestrator
   */
  registerService(name: string, service: any): void {
    if (this.services[name]) {
      this.logger.warn(`Service with name "${name}" is already registered`);
    }
    
    this.services[name] = service;
    this.logger.debug(`Service registered: ${name}`);
    
    // Emit service registered event
    this.emit('service:registered', { name, service });
  }

  /**
   * Get a service by name
   */
  getService<T = any>(name: string): T {
    const service = this.services[name];
    
    if (!service) {
      this.logger.error(`Service not found: ${name}`);
      throw new Error(`Service not found: ${name}`);
    }
    
    return service as T;
  }

  /**
   * Get specific core services with proper typing
   */
  getDynamoDBService(): DynamoDBService {
    return this.getService<DynamoDBService>('dynamoDb');
  }

  getTonService(): TonService {
    return this.getService<TonService>('ton');
  }

  getVerificationService(): VerificationService {
    return this.getService<VerificationService>('verification');
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): void {
    this.eventEmitter.on(event, handler);
    this.logger.debug(`Event handler registered for: ${event}`);
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, handler: EventHandler): void {
    this.eventEmitter.once(event, handler);
    this.logger.debug(`One-time event handler registered for: ${event}`);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void {
    this.eventEmitter.off(event, handler);
    this.logger.debug(`Event handler removed for: ${event}`);
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): boolean {
    this.logger.debug(`Emitting event: ${event}`);
    return this.eventEmitter.emit(event, ...args);
  }

  /**
   * Execute a function with all the necessary services injected
   */
  async executeWithServices<T>(
    fn: (services: ServiceMap) => Promise<T> | T
  ): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await fn(this.services);
    } catch (error) {
      this.logger.error('Error executing function with services', { error });
      throw error;
    }
  }
}

/**
 * Create a service orchestrator instance
 */
export function createServiceOrchestrator(
  options: ServiceOrchestratorOptions = {}
): ServiceOrchestrator {
  return new ServiceOrchestrator(options);
} 