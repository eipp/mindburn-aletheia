import { TonClient } from '@ton/ton';
import { TEST_CONFIG } from './config';

export default async function globalSetup() {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
  
  // Set up test network
  const client = new TonClient({
    endpoint: TEST_CONFIG.network.endpoint,
  });

  // Verify network connection and get initial state
  try {
    const lastBlock = await client.getLastBlock();
    console.log('Connected to TON network, last block:', lastBlock.last.seqno);
    
    // Store initial state for tests
    global.__testContext = {
      initialBlock: lastBlock.last.seqno,
      startTime: Date.now(),
    };
  } catch (error) {
    console.error('Failed to initialize test environment:', error);
    throw error;
  }
} 