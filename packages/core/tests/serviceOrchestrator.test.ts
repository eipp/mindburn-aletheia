import { ServiceOrchestrator, createServiceOrchestrator, SystemEventType } from '../src';
import { EventEmitter } from 'events';

// Mock the event emitter
jest.mock('events', () => {
  const mockEmit = jest.fn().mockReturnValue(true);
  const mockOn = jest.fn();
  const mockOnce = jest.fn();
  const mockOff = jest.fn();
  const mockRemoveAllListeners = jest.fn();
  
  return {
    EventEmitter: jest.fn().mockImplementation(() => ({
      emit: mockEmit,
      on: mockOn,
      once: mockOnce,
      off: mockOff,
      removeAllListeners: mockRemoveAllListeners,
      setMaxListeners: jest.fn(),
    })),
  };
});

// Create mock services
const createMockService = (name: string, hasInitialize = true, hasShutdown = true) => {
  return {
    name,
    initialize: hasInitialize ? jest.fn().mockResolvedValue(undefined) : undefined,
    shutdown: hasShutdown ? jest.fn().mockResolvedValue(undefined) : undefined,
    someMethod: jest.fn(),
  };
};

describe('Service Orchestrator', () => {
  let orchestrator: ServiceOrchestrator;
  let mockLogger: any;
  
  beforeEach(() => {
    // Reset the mocks
    jest.clearAllMocks();
    
    // Create a mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    
    // Create a new orchestrator for each test
    orchestrator = createServiceOrchestrator({
      logger: mockLogger,
    });
  });
  
  describe('Service registration and retrieval', () => {
    test('should register and retrieve services', () => {
      const mockService = createMockService('testService');
      
      orchestrator.registerService('test', mockService);
      const retrievedService = orchestrator.getService('test');
      
      expect(retrievedService).toBe(mockService);
    });
    
    test('should throw error when retrieving non-existent service', () => {
      expect(() => orchestrator.getService('nonexistent')).toThrow('Service not found');
    });
    
    test('should warn when registering duplicate service', () => {
      const mockService1 = createMockService('service1');
      const mockService2 = createMockService('service2');
      
      orchestrator.registerService('duplicate', mockService1);
      orchestrator.registerService('duplicate', mockService2);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Service with name "duplicate" is already registered')
      );
    });
  });
  
  describe('Initialization and shutdown', () => {
    test('should initialize all registered services', async () => {
      const service1 = createMockService('service1');
      const service2 = createMockService('service2');
      
      orchestrator.registerService('service1', service1);
      orchestrator.registerService('service2', service2);
      
      await orchestrator.initialize();
      
      expect(service1.initialize).toHaveBeenCalled();
      expect(service2.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Service orchestrator initialized successfully');
    });
    
    test('should handle services without initialize method', async () => {
      const service1 = createMockService('service1');
      const service2 = createMockService('service2', false);
      
      orchestrator.registerService('service1', service1);
      orchestrator.registerService('service2', service2);
      
      await orchestrator.initialize();
      
      expect(service1.initialize).toHaveBeenCalled();
      // Service2 doesn't have initialize, should not cause errors
      expect(mockLogger.info).toHaveBeenCalledWith('Service orchestrator initialized successfully');
    });
    
    test('should throw error when service initialization fails', async () => {
      const service = createMockService('failingService');
      service.initialize = jest.fn().mockRejectedValue(new Error('Initialization failed'));
      
      orchestrator.registerService('failing', service);
      
      await expect(orchestrator.initialize()).rejects.toThrow('Service initialization failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('should shutdown services in reverse order', async () => {
      const service1 = createMockService('service1');
      const service2 = createMockService('service2');
      
      orchestrator.registerService('service1', service1);
      orchestrator.registerService('service2', service2);
      
      await orchestrator.initialize();
      await orchestrator.shutdown();
      
      // Shutdown should be called in reverse order
      const mockEventEmitter = EventEmitter.mock.results[0].value;
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(SystemEventType.SHUTTING_DOWN, expect.anything());
      
      expect(service2.shutdown).toHaveBeenCalledBefore(service1.shutdown as jest.Mock);
      expect(mockEventEmitter.removeAllListeners).toHaveBeenCalled();
    });
    
    test('should continue shutdown even if a service fails', async () => {
      const service1 = createMockService('service1');
      const service2 = createMockService('service2');
      
      service1.shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));
      
      orchestrator.registerService('service1', service1);
      orchestrator.registerService('service2', service2);
      
      await orchestrator.initialize();
      await orchestrator.shutdown();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to shut down service: service1'),
        expect.anything()
      );
      expect(service2.shutdown).toHaveBeenCalled();
    });
  });
  
  describe('Event system', () => {
    test('should register and emit events', () => {
      const handler = jest.fn();
      orchestrator.on('test:event', handler);
      
      orchestrator.emit('test:event', { data: 'test' });
      
      const mockEventEmitter = EventEmitter.mock.results[0].value;
      expect(mockEventEmitter.on).toHaveBeenCalledWith('test:event', handler);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });
    
    test('should register one-time event handlers', () => {
      const handler = jest.fn();
      orchestrator.once('test:event', handler);
      
      const mockEventEmitter = EventEmitter.mock.results[0].value;
      expect(mockEventEmitter.once).toHaveBeenCalledWith('test:event', handler);
    });
    
    test('should remove event handlers', () => {
      const handler = jest.fn();
      orchestrator.on('test:event', handler);
      orchestrator.off('test:event', handler);
      
      const mockEventEmitter = EventEmitter.mock.results[0].value;
      expect(mockEventEmitter.off).toHaveBeenCalledWith('test:event', handler);
    });
  });
  
  describe('Service execution', () => {
    test('should execute functions with services injected', async () => {
      const service1 = createMockService('service1');
      orchestrator.registerService('service1', service1);
      
      const mockFn = jest.fn().mockReturnValue('result');
      const result = await orchestrator.executeWithServices(mockFn);
      
      expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({
        service1,
      }));
      expect(result).toBe('result');
    });
    
    test('should initialize services if needed before execution', async () => {
      const service1 = createMockService('service1');
      orchestrator.registerService('service1', service1);
      
      const mockFn = jest.fn().mockReturnValue('result');
      await orchestrator.executeWithServices(mockFn);
      
      expect(service1.initialize).toHaveBeenCalled();
    });
    
    test('should handle errors in executed functions', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Execution failed'));
      
      await expect(orchestrator.executeWithServices(mockFn)).rejects.toThrow('Execution failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error executing function with services',
        expect.anything()
      );
    });
  });
}); 