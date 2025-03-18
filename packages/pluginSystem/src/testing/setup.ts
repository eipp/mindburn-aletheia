import { PluginManager } from '../core/PluginManager';
import { PluginAnalytics } from '../analytics/PluginAnalytics';
import { PluginErrorHandler } from '../errors/PluginError';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPlugin(): R;
      toHaveValidManifest(): R;
      toBeSecure(): R;
      toHavePermission(permission: string): R;
    }
  }
}

// Mock system resources
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    postMessage: jest.fn(),
    terminate: jest.fn(),
  })),
}));

// Create test utilities
export const createTestPlugin = () => {
  const manager = new PluginManager('1.0.0');
  const analytics = new PluginAnalytics();
  const errorHandler = new PluginErrorHandler();

  return {
    manager,
    analytics,
    errorHandler,
  };
};

// Add custom matchers
expect.extend({
  toBeValidPlugin(received) {
    const isValid =
      received &&
      typeof received.initialize === 'function' &&
      typeof received.terminate === 'function' &&
      received.manifest;

    return {
      message: () => `expected ${received} to be a valid plugin`,
      pass: isValid,
    };
  },

  toHaveValidManifest(received) {
    const hasRequiredFields =
      received?.manifest &&
      typeof received.manifest.id === 'string' &&
      typeof received.manifest.name === 'string' &&
      typeof received.manifest.version === 'string' &&
      Array.isArray(received.manifest.permissions);

    return {
      message: () => `expected ${received} to have a valid manifest`,
      pass: hasRequiredFields,
    };
  },

  toBeSecure(received) {
    const hasNoRestrictedCalls = !received
      .toString()
      .match(/(eval|Function|require|process\.env|globalThis)/);

    return {
      message: () => `expected ${received} to be secure`,
      pass: hasNoRestrictedCalls,
    };
  },

  toHavePermission(received, permission) {
    const hasPermission = received?.manifest?.permissions?.includes(permission);

    return {
      message: () => `expected ${received} to have permission "${permission}"`,
      pass: hasPermission,
    };
  },
});

// Global test setup
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterAll(() => {
  // Clean up test environment
  jest.restoreAllMocks();
});
