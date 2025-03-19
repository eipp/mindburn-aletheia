import { TonClient, Address, toNano, Cell, beginCell } from '@ton/ton';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORK = process.env.NETWORK || 'testnet';
const MNEMONIC = process.env.MNEMONIC || '';
const API_KEY = process.env.TON_API_KEY || '';
const ITERATIONS = parseInt(process.env.ITERATIONS || '10', 10);

// API endpoints
const ENDPOINTS = {
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};

// Paths
const BUILD_DIR = path.resolve(__dirname, '../build');

// Helper to load deployed contract addresses
function loadDeployedContracts(): { [key: string]: string } {
  try {
    const deploymentFile = path.join(BUILD_DIR, `deployment-${NETWORK}.json`);
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`Deployment file not found: ${deploymentFile}`);
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    return deployment.contracts;
  } catch (error) {
    console.error('Failed to load deployment file:', error);
    throw error;
  }
}

// Load wallet
async function loadWallet(client: TonClient): Promise<{ wallet: any; keypair: KeyPair; address: Address }> {
  if (!MNEMONIC) {
    throw new Error('MNEMONIC environment variable is not set');
  }

  const keypair = await mnemonicToPrivateKey(MNEMONIC.split(' '));
  
  // Create a simple wallet
  const wallet = WalletContractV4.create({ publicKey: keypair.publicKey, workchain: 0 });
  const address = wallet.address;
  
  const balance = await client.getBalance(address);
  console.log(`Wallet address: ${address.toString()}`);
  console.log(`Balance: ${fromNano(balance)} TON`);
  
  if (balance === BigInt(0)) {
    throw new Error('Wallet has no balance. Please fund it before proceeding.');
  }
  
  return { wallet, keypair, address };
}

// Benchmark functions
async function benchmarkGovernanceToken(client: TonClient, wallet: any, keypair: KeyPair, governanceAddress: Address) {
  console.log('\n=== Benchmarking Governance Token ===');
  
  // Create a sample proposal
  const proposalData = beginCell()
    .storeUint(1, 8) // Action count
    .storeRef(
      beginCell()
        .storeAddress(wallet.address) // Target address
        .storeCoins(toNano('0.01')) // Value
        .storeRef(
          beginCell()
            .storeUint(1, 32) // Op code
            .storeUint(0, 64) // Query ID
            .endCell()
        )
        .endCell()
    )
    .storeRef(
      beginCell()
        .storeBuffer(Buffer.from('Test proposal', 'utf-8'))
        .endCell()
    )
    .endCell();
  
  console.log(`Sending ${ITERATIONS} create proposal transactions...`);
  const startTime = Date.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    const seqno = await wallet.getSeqno();
    
    const msg = beginCell()
      .storeUint(0x18, 6) // nobounce
      .storeAddress(governanceAddress)
      .storeCoins(toNano('0.05'))
      .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
      .storeRef(
        beginCell()
          .storeUint(1, 32) // op: OP_CREATE_PROPOSAL
          .storeUint(0, 64) // query_id
          .storeRef(proposalData)
          .endCell()
      )
      .endCell();
    
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keypair.secretKey,
      messages: [internal({
        to: governanceAddress,
        value: toNano('0.05'),
        body: msg,
      })],
    });
    
    await client.sendExternalMessage(wallet, transfer);
    
    // Wait a bit between transactions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`Transaction ${i + 1}/${ITERATIONS} sent`);
  }
  
  const endTime = Date.now();
  const durationSeconds = (endTime - startTime) / 1000;
  console.log(`\nCompleted in ${durationSeconds.toFixed(2)}s`);
  console.log(`Average transaction time: ${(durationSeconds / ITERATIONS).toFixed(2)}s`);
}

async function benchmarkReputationToken(client: TonClient, wallet: any, keypair: KeyPair, reputationAddress: Address) {
  console.log('\n=== Benchmarking Reputation Token ===');
  
  // Create a test worker address (we'll use wallet address)
  const workerAddress = wallet.address;
  
  console.log(`Sending ${ITERATIONS} reputation update transactions...`);
  const startTime = Date.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    // Verification score between 75 and 100
    const verificationScore = 75 + Math.floor(Math.random() * 26);
    
    const seqno = await wallet.getSeqno();
    
    const msg = beginCell()
      .storeUint(0x18, 6) // nobounce
      .storeAddress(reputationAddress)
      .storeCoins(toNano('0.05'))
      .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
      .storeRef(
        beginCell()
          .storeUint(1, 32) // op: OP_UPDATE_REPUTATION
          .storeUint(0, 64) // query_id
          .storeAddress(workerAddress)
          .storeUint(verificationScore, 8)
          .endCell()
      )
      .endCell();
    
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keypair.secretKey,
      messages: [internal({
        to: reputationAddress,
        value: toNano('0.05'),
        body: msg,
      })],
    });
    
    await client.sendExternalMessage(wallet, transfer);
    
    // Wait a bit between transactions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`Transaction ${i + 1}/${ITERATIONS} sent - Score: ${verificationScore}`);
  }
  
  const endTime = Date.now();
  const durationSeconds = (endTime - startTime) / 1000;
  console.log(`\nCompleted in ${durationSeconds.toFixed(2)}s`);
  console.log(`Average transaction time: ${(durationSeconds / ITERATIONS).toFixed(2)}s`);
}

async function benchmarkUtilityToken(client: TonClient, wallet: any, keypair: KeyPair, utilityAddress: Address) {
  console.log('\n=== Benchmarking Utility Token ===');
  
  // Add wallet as a minter first
  console.log('Adding wallet as a minter...');
  const seqnoMinter = await wallet.getSeqno();
  
  const mintMsg = beginCell()
    .storeUint(0x18, 6) // nobounce
    .storeAddress(utilityAddress)
    .storeCoins(toNano('0.05'))
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
    .storeRef(
      beginCell()
        .storeUint(8, 32) // op: OP_ADD_MINTER
        .storeUint(0, 64) // query_id
        .storeAddress(wallet.address)
        .endCell()
    )
    .endCell();
  
  const transferMinter = wallet.createTransfer({
    seqno: seqnoMinter,
    secretKey: keypair.secretKey,
    messages: [internal({
      to: utilityAddress,
      value: toNano('0.05'),
      body: mintMsg,
    })],
  });
  
  await client.sendExternalMessage(wallet, transferMinter);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Benchmark minting
  console.log(`Sending ${ITERATIONS} mint transactions...`);
  const startTime = Date.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    const amount = toNano('10'); // 10 tokens
    
    const seqno = await wallet.getSeqno();
    
    const msg = beginCell()
      .storeUint(0x18, 6) // nobounce
      .storeAddress(utilityAddress)
      .storeCoins(toNano('0.05'))
      .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
      .storeRef(
        beginCell()
          .storeUint(1, 32) // op: OP_MINT
          .storeUint(0, 64) // query_id
          .storeAddress(wallet.address)
          .storeUint(amount, 64)
          .endCell()
      )
      .endCell();
    
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keypair.secretKey,
      messages: [internal({
        to: utilityAddress,
        value: toNano('0.05'),
        body: msg,
      })],
    });
    
    await client.sendExternalMessage(wallet, transfer);
    
    // Wait a bit between transactions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`Transaction ${i + 1}/${ITERATIONS} sent - Amount: ${fromNano(amount)} tokens`);
  }
  
  const endTime = Date.now();
  const durationSeconds = (endTime - startTime) / 1000;
  console.log(`\nCompleted in ${durationSeconds.toFixed(2)}s`);
  console.log(`Average transaction time: ${(durationSeconds / ITERATIONS).toFixed(2)}s`);
}

// Main benchmark function
async function runBenchmarks() {
  try {
    console.log(`\nRunning benchmarks on ${NETWORK} network...`);
    console.log(`Number of iterations: ${ITERATIONS}`);
    
    // Initialize TonClient
    const client = new TonClient({
      endpoint: ENDPOINTS[NETWORK],
      apiKey: API_KEY,
    });
    
    // Load wallet
    const { wallet, keypair } = await loadWallet(client);
    
    // Load contract addresses
    const contracts = loadDeployedContracts();
    const governanceAddress = Address.parse(contracts.governance);
    const reputationAddress = Address.parse(contracts.reputation);
    const utilityAddress = Address.parse(contracts.utility);
    
    // Run benchmarks
    await benchmarkGovernanceToken(client, wallet, keypair, governanceAddress);
    await benchmarkReputationToken(client, wallet, keypair, reputationAddress);
    await benchmarkUtilityToken(client, wallet, keypair, utilityAddress);
    
    console.log('\nAll benchmarks completed successfully');
    
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Run the benchmarks
runBenchmarks().catch(console.error); 