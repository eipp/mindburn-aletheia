import { TonClient } from '@ton/ton';
import { TEST_CONFIG } from './config';

export default async function globalTeardown() {
  // Get test context
  const testContext = global.__testContext;

  // Calculate test duration
  const duration = Date.now() - testContext.startTime;
  console.log(`Test suite completed in ${duration}ms`);

  // Connect to network for final checks
  const client = new TonClient({
    endpoint: TEST_CONFIG.network.endpoint,
  });

  try {
    // Get final block
    const lastBlock = await client.getLastBlock();
    const blocksDelta = lastBlock.last.seqno - testContext.initialBlock;
    console.log(`Processed ${blocksDelta} blocks during tests`);

    // Clean up any remaining test data
    delete global.__testContext;
  } catch (error) {
    console.error('Error during test teardown:', error);
    throw error;
  }
}
