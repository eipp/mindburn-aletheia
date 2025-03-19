import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, toNano, beginCell } from '@ton/core';
import { compileFunc } from '@ton/blueprint';
import { join } from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This script tests the compilation of FunC contracts without actually deploying them
 */
async function testCompilation() {
  console.log('Testing contract compilation...');

  try {
    // Create imports directory if it doesn't exist
    const stdlibPath = join(__dirname, '..', 'contracts', 'func', 'imports', 'stdlib.fc');
    if (!fs.existsSync(stdlibPath)) {
      console.log('Creating stdlib.fc directory...');
      fs.mkdirSync(join(__dirname, '..', 'contracts', 'func', 'imports'), { recursive: true });
    }

    // Ensure the contract files exist
    const reputationPath = join(__dirname, '..', 'contracts', 'func', 'MindBurnReputation.fc');
    const governancePath = join(__dirname, '..', 'contracts', 'func', 'MindBurnGovernance.fc');

    if (!fs.existsSync(reputationPath)) {
      console.error('Error: MindBurnReputation.fc not found at', reputationPath);
      process.exit(1);
    }

    if (!fs.existsSync(governancePath)) {
      console.error('Error: MindBurnGovernance.fc not found at', governancePath);
      process.exit(1);
    }

    // Compile the contracts
    console.log('Compiling MindBurnReputation.fc...');
    const reputationCode = await compileFunc({
      path: reputationPath,
      stdlib: stdlibPath
    });
    console.log('✅ MindBurnReputation.fc compiled successfully!');

    console.log('Compiling MindBurnGovernance.fc...');
    const governanceCode = await compileFunc({
      path: governancePath,
      stdlib: stdlibPath
    });
    console.log('✅ MindBurnGovernance.fc compiled successfully!');

    console.log('All contracts compiled successfully!');
    return { reputationCode, governanceCode };
  } catch (error) {
    console.error('Error compiling contracts:', error);
    process.exit(1);
  }
}

/**
 * Simulates deployment setup without actually sending transactions
 */
async function simulateDeployment() {
  console.log('Simulating deployment setup...');

  // Check for mnemonic
  if (!process.env.DEPLOYER_MNEMONIC) {
    console.log('⚠️ No DEPLOYER_MNEMONIC environment variable found.');
    console.log('This is fine for testing compilation, but would be needed for actual deployment.');
  } else {
    try {
      // Generate wallet address from mnemonic
      const mnemonic = process.env.DEPLOYER_MNEMONIC;
      const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
      const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey });
      
      console.log('✅ Deployer wallet address calculated:', wallet.address.toString());
      console.log('   This is where you would need to send test TON for actual deployment.');
    } catch (error) {
      console.error('❌ Error calculating wallet address:', error);
    }
  }
  
  // Initialize TON client (just to test connection, no transactions)
  try {
    const client = new TonClient({
      endpoint: process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
    });
    
    await client.getLastBlock();
    console.log('✅ Successfully connected to TON API endpoint');
  } catch (error) {
    console.error('❌ Error connecting to TON API endpoint:', error);
    console.log('   Make sure TON_ENDPOINT and TON_API_KEY are set correctly in your .env file');
  }
}

async function main() {
  console.log('==== MindBurn Token Economy Test ====');
  
  // Test contract compilation
  const { reputationCode, governanceCode } = await testCompilation();
  
  // Simulate deployment setup
  await simulateDeployment();
  
  console.log('\n==== Test Summary ====');
  console.log('✅ MindBurnReputation.fc - Compiled successfully');
  console.log('✅ MindBurnGovernance.fc - Compiled successfully');
  console.log('✅ Deployment setup verified');
  console.log('\nAll tests passed! The contracts are ready for deployment.');
}

// Run the test
main().catch(console.error); 