import { TonClient, Address, beginCell, toNano, Cell } from '@ton/ton';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORK = process.env.NETWORK || 'testnet';
const MNEMONIC = process.env.MNEMONIC || '';
const API_KEY = process.env.TON_API_KEY || '';

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

// Example 1: Create Governance Proposal
async function exampleCreateProposal(client: TonClient, wallet: any, keypair: KeyPair, governanceAddress: Address) {
  console.log('\n=== Example 1: Create Governance Proposal ===');
  
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
        .storeBuffer(Buffer.from('Example proposal for MindBurn platform', 'utf-8'))
        .endCell()
    )
    .endCell();
  
  console.log('Creating a new governance proposal...');
  
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
  console.log('Proposal creation transaction sent');
  
  // Wait for transaction to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check proposal count
  console.log('Checking proposal count...');
  const proposalCount = await client.callGetMethod(governanceAddress, 'get_proposal_count', []);
  console.log(`Current proposal count: ${proposalCount}`);
}

// Example 2: Cast Vote
async function exampleCastVote(client: TonClient, wallet: any, keypair: KeyPair, governanceAddress: Address) {
  console.log('\n=== Example 2: Cast Vote ===');
  
  // Get proposal count
  const proposalCount = await client.callGetMethod(governanceAddress, 'get_proposal_count', []);
  if (Number(proposalCount) === 0) {
    console.log('No proposals to vote on. Please create a proposal first.');
    return;
  }
  
  // Vote on the latest proposal
  const proposalId = Number(proposalCount);
  const voteType = 1; // 1 = FOR
  
  console.log(`Casting vote (FOR) on proposal #${proposalId}...`);
  
  const seqno = await wallet.getSeqno();
  
  const msg = beginCell()
    .storeUint(0x18, 6) // nobounce
    .storeAddress(governanceAddress)
    .storeCoins(toNano('0.05'))
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
    .storeRef(
      beginCell()
        .storeUint(2, 32) // op: OP_CAST_VOTE
        .storeUint(0, 64) // query_id
        .storeUint(proposalId, 32) // proposal_id
        .storeUint(voteType, 8) // vote: FOR
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
  console.log('Vote transaction sent');
  
  // Wait for transaction to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check vote status
  console.log('Checking vote status...');
  const voteStatus = await client.callGetMethod(governanceAddress, 'get_proposal_votes', [
    ['num', proposalId.toString()]
  ]);
  console.log(`Vote status for proposal #${proposalId}: ${voteStatus}`);
}

// Example 3: Update Reputation
async function exampleUpdateReputation(client: TonClient, wallet: any, keypair: KeyPair, reputationAddress: Address) {
  console.log('\n=== Example 3: Update Worker Reputation ===');
  
  // Create a test worker address (we'll use wallet address)
  const workerAddress = wallet.address;
  
  // Random verification score between 75 and 100
  const verificationScore = 75 + Math.floor(Math.random() * 26);
  
  console.log(`Updating reputation for worker ${workerAddress.toString()}...`);
  console.log(`Verification score: ${verificationScore}`);
  
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
  console.log('Reputation update transaction sent');
  
  // Wait for transaction to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check worker reputation
  console.log('Checking worker reputation...');
  const reputation = await client.callGetMethod(reputationAddress, 'get_worker_reputation', [
    ['tvm.Slice', beginCell().storeAddress(workerAddress).endCell().beginParse()]
  ]);
  console.log(`Current worker reputation: ${reputation}`);
  
  // Check worker level
  console.log('Checking worker level...');
  const level = await client.callGetMethod(reputationAddress, 'get_worker_level', [
    ['tvm.Slice', beginCell().storeAddress(workerAddress).endCell().beginParse()]
  ]);
  console.log(`Current worker level: ${level}`);
}

// Example 4: Mint Utility Tokens
async function exampleMintTokens(client: TonClient, wallet: any, keypair: KeyPair, utilityAddress: Address) {
  console.log('\n=== Example 4: Mint Utility Tokens ===');
  
  // First, add our wallet as a minter if it's not already
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
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Minter status updated');
  
  // Check if wallet is a minter
  const isMinter = await client.callGetMethod(utilityAddress, 'is_address_minter', [
    ['tvm.Slice', beginCell().storeAddress(wallet.address).endCell().beginParse()]
  ]);
  console.log(`Is wallet a minter? ${isMinter}`);
  
  // Mint tokens
  const mintAmount = toNano('100'); // 100 tokens
  console.log(`Minting ${fromNano(mintAmount)} tokens to ${wallet.address.toString()}...`);
  
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
        .storeUint(mintAmount, 64)
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
  console.log('Mint transaction sent');
  
  // Wait for transaction to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check total supply
  console.log('Checking total supply...');
  const totalSupply = await client.callGetMethod(utilityAddress, 'get_total_supply', []);
  console.log(`Current total supply: ${fromNano(totalSupply)} tokens`);
  
  // Get wallet address
  console.log('Getting wallet address for owner...');
  const walletAddr = await client.callGetMethod(utilityAddress, 'get_wallet_address', [
    ['tvm.Slice', beginCell().storeAddress(wallet.address).endCell().beginParse()]
  ]);
  console.log(`Token wallet address: ${walletAddr}`);
}

// Example 5: Governance Integration with Utility Token
async function exampleGovernanceTokenIntegration(client: TonClient, wallet: any, keypair: KeyPair, governanceAddress: Address, utilityAddress: Address) {
  console.log('\n=== Example 5: Governance Integration with Utility Token ===');
  
  console.log('Creating proposal via utility token governance function...');
  
  // Create a governance proposal action
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
        .storeBuffer(Buffer.from('Governance integration example', 'utf-8'))
        .endCell()
    )
    .endCell();
  
  const seqno = await wallet.getSeqno();
  
  const msg = beginCell()
    .storeUint(0x18, 6) // nobounce
    .storeAddress(utilityAddress)
    .storeCoins(toNano('0.05'))
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // schema
    .storeRef(
      beginCell()
        .storeUint(10, 32) // op: OP_PROPOSE_GOVERNANCE_ACTION
        .storeUint(0, 64) // query_id
        .storeRef(proposalData)
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
  console.log('Governance proposal transaction sent via utility token');
  
  // Wait for transaction to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check proposal count after integration
  console.log('Checking proposal count...');
  const proposalCount = await client.callGetMethod(governanceAddress, 'get_proposal_count', []);
  console.log(`Current proposal count: ${proposalCount}`);
}

// Main function
async function runExamples() {
  try {
    console.log(`\nRunning examples on ${NETWORK} network...`);
    
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
    
    console.log('\nLoaded contract addresses:');
    console.log(`- Governance: ${governanceAddress.toString()}`);
    console.log(`- Reputation: ${reputationAddress.toString()}`);
    console.log(`- Utility: ${utilityAddress.toString()}`);
    
    // Run examples
    await exampleCreateProposal(client, wallet, keypair, governanceAddress);
    await exampleCastVote(client, wallet, keypair, governanceAddress);
    await exampleUpdateReputation(client, wallet, keypair, reputationAddress);
    await exampleMintTokens(client, wallet, keypair, utilityAddress);
    await exampleGovernanceTokenIntegration(client, wallet, keypair, governanceAddress, utilityAddress);
    
    console.log('\nAll examples completed successfully');
    
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the examples
runExamples().catch(console.error); 