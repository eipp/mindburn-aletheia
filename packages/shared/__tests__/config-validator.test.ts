import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator
} from '../src';

interface TestConfig {
  apiKey: string;
  endpoint: string;
  maxConnections: number;
  timeout: number;
  features: string[];
}

const defaultConfig: TestConfig = {
  apiKey: '',
  endpoint: 'http://localhost:8080',
  maxConnections: 10,
  timeout: 5000,
  features: ['basic']
};

const schema = z.object({
  apiKey: z.string(),
  endpoint: z.string().url(),
  maxConnections: z.number().min(1).max(100),
  timeout: z.number().min(1000),
  features: z.array(z.string())
});

describe('Configuration Validation System', () => {
  describe('createConfigValidator', () => {
    const validator = createConfigValidator({
      schema,
      defaultConfig
    });

    it('should merge with default config', () => {
      const result = validator({
        apiKey: 'test-key'
      });
      expect(result).toEqual({
        ...defaultConfig,
        apiKey: 'test-key'
      });
    });

    it('should validate against schema', () => {
      expect(() => validator({
        maxConnections: 0
      })).toThrow();

      expect(() => validator({
        endpoint: 'invalid-url'
      })).toThrow();
    });

    it('should handle array merging correctly', () => {
      const result = validator({
        features: ['advanced']
      });
      expect(result.features).toEqual(['advanced']);
    });
  });

  describe('createEnvironmentTransformer', () => {
    const envMap = {
      apiKey: 'TEST_API_KEY',
      endpoint: 'TEST_ENDPOINT',
      maxConnections: 'TEST_MAX_CONNECTIONS',
      timeout: 'TEST_TIMEOUT',
      features: 'TEST_FEATURES'
    };

    beforeEach(() => {
      process.env.TEST_API_KEY = 'env-key';
      process.env.TEST_ENDPOINT = 'http://test.com';
      process.env.TEST_MAX_CONNECTIONS = '20';
    });

    afterEach(() => {
      delete process.env.TEST_API_KEY;
      delete process.env.TEST_ENDPOINT;
      delete process.env.TEST_MAX_CONNECTIONS;
    });

    it('should transform config using environment variables', () => {
      const transformer = createEnvironmentTransformer(envMap);
      const result = transformer({});

      expect(result).toEqual({
        apiKey: 'env-key',
        endpoint: 'http://test.com',
        maxConnections: '20'
      });
    });

    it('should preserve existing values when env vars are not set', () => {
      const transformer = createEnvironmentTransformer(envMap);
      const result = transformer({
        timeout: 3000
      });

      expect(result.timeout).toBe(3000);
    });
  });

  describe('createSecurityValidator', () => {
    const validator = createSecurityValidator(['apiKey']);

    it('should detect potential security issues', () => {
      const result = validator({
        apiKey: 'Bearer abc123xyz789'
      } as TestConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Security violation');
    });

    it('should warn about potential API keys', () => {
      const result = validator({
        apiKey: 'ABCDEF123456789ABCDEF'
      } as TestConfig);

      expect(result.warnings[0]).toContain('API key');
    });

    it('should pass valid configurations', () => {
      const result = validator({
        apiKey: 'test-key'
      } as TestConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createPerformanceValidator', () => {
    const validator = createPerformanceValidator({
      maxConnections: 50,
      timeout: 10000
    });

    it('should warn about performance thresholds', () => {
      const result = validator({
        maxConnections: 75,
        timeout: 15000
      } as TestConfig);

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('maxConnections');
      expect(result.warnings[1]).toContain('timeout');
    });

    it('should pass when within thresholds', () => {
      const result = validator({
        maxConnections: 30,
        timeout: 5000
      } as TestConfig);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Integration', () => {
    const validator = createConfigValidator({
      schema,
      defaultConfig,
      transformers: [
        createEnvironmentTransformer({
          apiKey: 'TEST_API_KEY',
          endpoint: 'TEST_ENDPOINT'
        })
      ],
      validators: [
        createSecurityValidator(['apiKey']),
        createPerformanceValidator({
          maxConnections: 50,
          timeout: 10000
        })
      ]
    });

    beforeEach(() => {
      process.env.TEST_API_KEY = 'test-key';
      process.env.TEST_ENDPOINT = 'http://test.com';
    });

    afterEach(() => {
      delete process.env.TEST_API_KEY;
      delete process.env.TEST_ENDPOINT;
    });

    it('should validate complete configuration flow', () => {
      const result = validator({
        maxConnections: 75,
        timeout: 15000
      });

      expect(result).toMatchObject({
        apiKey: 'test-key',
        endpoint: 'http://test.com',
        maxConnections: 75,
        timeout: 15000
      });

      // Console should have warnings about performance thresholds
      expect(console.warn).toHaveBeenCalled();
    });
  });
}); 