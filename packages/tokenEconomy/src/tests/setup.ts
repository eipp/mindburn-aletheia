import { TonClient } from '@ton/ton';
import { TEST_CONFIG } from './config';

// Extend Jest matchers
expect.extend({
  toBeValidAddress(received) {
    const pass = /^EQD[a-zA-Z0-9_-]{44}$/.test(received);
    return {
      message: () => `expected ${received} to be a valid TON address`,
      pass,
    };
  },

  toBeBigIntCloseTo(received: bigint, target: bigint, delta: bigint) {
    const difference = received > target ? received - target : target - received;
    const pass = difference <= delta;
    return {
      message: () => `expected ${received} to be within ${delta} of ${target}`,
      pass,
    };
  },
});

// Global test setup
beforeAll(async () => {
  // Initialize TON client
  const client = new TonClient({
    endpoint: TEST_CONFIG.network.endpoint,
  });

  // Verify network connection
  try {
    await client.getLastBlock();
  } catch (error) {
    console.error('Failed to connect to TON network:', error);
    throw error;
  }

  // Set global timeout
  jest.setTimeout(30000);
});

// Clean up after each test
afterEach(async () => {
  jest.clearAllMocks();
});

// Global teardown
afterAll(async () => {
  // Clean up any remaining resources
});
