import { TonClient, Address, Cell, beginCell, contractAddress, internal, storeStateInit, StateInit, toNano } from '@ton/ton';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import * as fs from 'fs';
import * as path from 'path';
import { compile } from '@ton/blueprint';

// Environment configuration
const NETWORK = process.env.NETWORK || 'testnet'; // 'mainnet' or 'testnet'
const MNEMONIC = process.env.MNEMONIC || '';
const API_KEY = process.env.TON_API_KEY || '';
const CONTRACT_NAMES = ['mindBurnGovernance', 'mindBurnReputation', 'MindBurnUtility'];

// API endpoints
const ENDPOINTS = {
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};

// Paths
const CONTRACTS_DIR = path.resolve(__dirname, '../tokens');
const OUTPUT_DIR = path.resolve(__dirname, '../build');

// Make sure the build directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Log success with deployment info
function logSuccess(name: string, address: string, network: string) {
  console.log(`\n✓ Contract ${name} deployed successfully on ${network}`);
  console.log(`  Address: ${address}`);
  console.log(`  Explorer: https://${network !== 'mainnet' ? 'testnet.' : ''}tonwhales.com/explorer/address/${address}`);
}

// Helper function to write deployment info to a file
function saveDeploymentInfo(name: string, address: string, network: string) {
  const deploymentInfo = {
    name,
    address,
    network,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}-${network}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
}

// Helper function to load the wallet
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

// Helper function to compile contract
async function compileContract(name: string): Promise<Cell> {
  try {
    const contractPath = path.join(CONTRACTS_DIR, `${name}.fc`);
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }
    
    const compiledBoc = await compile(contractPath);
    
    // Save compiled contract BOC to a file
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${name}.cell`),
      Buffer.from(compiledBoc.toBoc()).toString('base64')
    );
    
    return compiledBoc;
  } catch (error) {
    console.error(`Error compiling contract ${name}:`, error);
    throw error;
  }
}

// Deploy Governance Token contract
async function deployGovernanceToken(client: TonClient, wallet: any, keypair: KeyPair): Promise<Address> {
  console.log('\nDeploying MindBurn Governance Token...');
  
  const contractName = 'mindBurnGovernance';
  const code = await compileContract(contractName);
  
  // Initialize empty data cells for storage
  const proposals = beginCell().endCell();
  const votes = beginCell().endCell();
  const proposalCount = 0;
  const tokenHolders = beginCell().endCell();
  const delegations = beginCell().endCell();
  const totalSupply = 0;
  const adminAddress = wallet.address; // Set wallet as the admin
  
  // Pack initial contract data
  const data = beginCell()
    .storeRef(proposals)
    .storeRef(votes)
    .storeUint(proposalCount, 32)
    .storeRef(tokenHolders)
    .storeRef(delegations)
    .storeUint(totalSupply, 64)
    .storeAddress(adminAddress)
    .endCell();
  
  // Create state init
  const stateInit: StateInit = {
    code,
    data,
  };
  
  const stateInitCell = beginCell()
    .store(storeStateInit(stateInit))
    .endCell();
  
  // Calculate the contract address
  const contractAddr = contractAddress({
    workchain: 0,
    initialCode: code,
    initialData: data,
  });
  
  console.log(`Calculated contract address: ${contractAddr.toString()}`);
  
  // Check if the contract is already deployed
  const isDeployed = await client.isContractDeployed(contractAddr);
  if (isDeployed) {
    console.log('Contract is already deployed. Skipping deployment.');
    return contractAddr;
  }
  
  // Create deployment transaction
  const seqno = await wallet.getSeqno();
  
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keypair.secretKey,
    to: contractAddr,
    value: toNano('0.5'), // 0.5 TON for deployment
    bounce: false,
    stateInit: stateInitCell,
  });
  
  // Send the deployment transaction
  await client.sendExternalMessage(wallet, transfer);
  
  // Wait for deployment confirmation
  console.log('Waiting for deployment confirmation...');
  let attempts = 0;
  let confirmedDeployed = false;
  
  while (attempts < 10 && !confirmedDeployed) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    confirmedDeployed = await client.isContractDeployed(contractAddr);
    attempts++;
  }
  
  if (!confirmedDeployed) {
    throw new Error('Contract deployment failed or taking too long to confirm');
  }
  
  // Save deployment info
  logSuccess(contractName, contractAddr.toString(), NETWORK);
  saveDeploymentInfo(contractName, contractAddr.toString(), NETWORK);
  
  return contractAddr;
}

// Deploy Reputation Token contract
async function deployReputationToken(client: TonClient, wallet: any, keypair: KeyPair): Promise<Address> {
  console.log('\nDeploying MindBurn Reputation Token...');
  
  const contractName = 'mindBurnReputation';
  const code = await compileContract(contractName);
  
  // Initialize empty data cells for storage
  const workersReputation = beginCell().endCell();
  const verificationHistory = beginCell().endCell();
  const adminAddresses = beginCell().endCell();
  const workerLevels = beginCell().endCell();
  const lastDecayTime = Math.floor(Date.now() / 1000); // Current timestamp
  
  // Initialize admin address
  const adminAddressesWithWallet = beginCell()
    .storeDict(beginCell()
      .storeUint(1, 1) // true value
      .endCell()
    , 267, wallet.address.hash) // Set wallet as the admin
    .endCell();
  
  // Pack initial contract data
  const data = beginCell()
    .storeRef(workersReputation)
    .storeRef(verificationHistory)
    .storeRef(adminAddressesWithWallet)
    .storeRef(workerLevels)
    .storeUint(lastDecayTime, 32)
    .endCell();
  
  // Create state init
  const stateInit: StateInit = {
    code,
    data,
  };
  
  const stateInitCell = beginCell()
    .store(storeStateInit(stateInit))
    .endCell();
  
  // Calculate the contract address
  const contractAddr = contractAddress({
    workchain: 0,
    initialCode: code,
    initialData: data,
  });
  
  console.log(`Calculated contract address: ${contractAddr.toString()}`);
  
  // Check if the contract is already deployed
  const isDeployed = await client.isContractDeployed(contractAddr);
  if (isDeployed) {
    console.log('Contract is already deployed. Skipping deployment.');
    return contractAddr;
  }
  
  // Create deployment transaction
  const seqno = await wallet.getSeqno();
  
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keypair.secretKey,
    to: contractAddr,
    value: toNano('0.5'), // 0.5 TON for deployment
    bounce: false,
    stateInit: stateInitCell,
  });
  
  // Send the deployment transaction
  await client.sendExternalMessage(wallet, transfer);
  
  // Wait for deployment confirmation
  console.log('Waiting for deployment confirmation...');
  let attempts = 0;
  let confirmedDeployed = false;
  
  while (attempts < 10 && !confirmedDeployed) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    confirmedDeployed = await client.isContractDeployed(contractAddr);
    attempts++;
  }
  
  if (!confirmedDeployed) {
    throw new Error('Contract deployment failed or taking too long to confirm');
  }
  
  // Save deployment info
  logSuccess(contractName, contractAddr.toString(), NETWORK);
  saveDeploymentInfo(contractName, contractAddr.toString(), NETWORK);
  
  return contractAddr;
}

// Deploy Utility Token contract
async function deployUtilityToken(client: TonClient, wallet: any, keypair: KeyPair): Promise<Address> {
  console.log('\nDeploying MindBurn Utility Token...');
  
  const contractName = 'MindBurnUtility';
  const code = await compileContract(contractName);
  
  // Get token wallet code (This should be implemented or provided)
  const tokenWalletCode = beginCell().endCell(); // Placeholder, you'd need the actual wallet code
  
  // Initialize empty data cells for storage
  const totalSupply = 0;
  const owner = wallet.address;
  const pendingOwner = beginCell().storeUint(0, 2).endCell(); // Empty address
  const minters = beginCell().endCell();
  const content = beginCell().endCell(); // Token metadata
  const wallets = beginCell().endCell();
  
  // Pack initial contract data
  const data = beginCell()
    .storeUint(totalSupply, 64)
    .storeAddress(owner)
    .storeAddress(pendingOwner.beginParse())
    .storeRef(tokenWalletCode)
    .storeRef(minters)
    .storeRef(content)
    .storeRef(wallets)
    .endCell();
  
  // Create state init
  const stateInit: StateInit = {
    code,
    data,
  };
  
  const stateInitCell = beginCell()
    .store(storeStateInit(stateInit))
    .endCell();
  
  // Calculate the contract address
  const contractAddr = contractAddress({
    workchain: 0,
    initialCode: code,
    initialData: data,
  });
  
  console.log(`Calculated contract address: ${contractAddr.toString()}`);
  
  // Check if the contract is already deployed
  const isDeployed = await client.isContractDeployed(contractAddr);
  if (isDeployed) {
    console.log('Contract is already deployed. Skipping deployment.');
    return contractAddr;
  }
  
  // Create deployment transaction
  const seqno = await wallet.getSeqno();
  
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keypair.secretKey,
    to: contractAddr,
    value: toNano('0.5'), // 0.5 TON for deployment
    bounce: false,
    stateInit: stateInitCell,
  });
  
  // Send the deployment transaction
  await client.sendExternalMessage(wallet, transfer);
  
  // Wait for deployment confirmation
  console.log('Waiting for deployment confirmation...');
  let attempts = 0;
  let confirmedDeployed = false;
  
  while (attempts < 10 && !confirmedDeployed) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    confirmedDeployed = await client.isContractDeployed(contractAddr);
    attempts++;
  }
  
  if (!confirmedDeployed) {
    throw new Error('Contract deployment failed or taking too long to confirm');
  }
  
  // Save deployment info
  logSuccess(contractName, contractAddr.toString(), NETWORK);
  saveDeploymentInfo(contractName, contractAddr.toString(), NETWORK);
  
  return contractAddr;
}

// Main deployment function
async function deploy() {
  try {
    console.log(`\nDeploying contracts to ${NETWORK} network...`);
    
    // Initialize TonClient
    const client = new TonClient({
      endpoint: ENDPOINTS[NETWORK],
      apiKey: API_KEY,
    });
    
    // Load wallet
    const { wallet, keypair, address } = await loadWallet(client);
    
    // Deploy contracts
    const governanceAddress = await deployGovernanceToken(client, wallet, keypair);
    const reputationAddress = await deployReputationToken(client, wallet, keypair);
    const utilityAddress = await deployUtilityToken(client, wallet, keypair);
    
    console.log('\nAll contracts deployed successfully:');
    console.log(`Governance Token: ${governanceAddress.toString()}`);
    console.log(`Reputation Token: ${reputationAddress.toString()}`);
    console.log(`Utility Token: ${utilityAddress.toString()}`);
    
    // Save the deployment configuration with all addresses
    const deploymentConfig = {
      network: NETWORK,
      deployedAt: new Date().toISOString(),
      contracts: {
        governance: governanceAddress.toString(),
        reputation: reputationAddress.toString(),
        utility: utilityAddress.toString(),
      }
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `deployment-${NETWORK}.json`),
      JSON.stringify(deploymentConfig, null, 2)
    );
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
deploy().catch(console.error); 