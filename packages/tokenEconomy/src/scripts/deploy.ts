import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, toNano, beginCell } from '@ton/core';
import { compileFunc } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MindBurnToken } from '../contracts/MindBurnToken';
import { MindBurnReputation } from '../contracts/MindBurnReputation';
import { MindBurnGovernance } from '../contracts/mindBurnGovernance';

async function deploy() {
  // Initialize TON client
  const client = new TonClient({
    endpoint: process.env.TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY,
  });

  // Load deployer wallet
  const mnemonic = process.env.DEPLOYER_MNEMONIC!;
  const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey });
  const sender = wallet.sender(client);

  console.log('Deploying contracts...');

  // Deploy MindBurn Utility Token (MBU)
  const mbuConfig = {
    totalSupply: BigInt(1_000_000_000), // 1 billion tokens
    owner: Address.parse(process.env.TREASURY_ADDRESS!),
    mintable: true,
  };

  const mbu = MindBurnToken.createFromConfig(mbuConfig, await loadCode('MindBurnUtility.fc'));

  await sender.send({
    to: mbu.address,
    value: toNano('1'),
    init: mbu.init,
    body: internal({
      value: toNano('0.1'),
      body: beginCell().storeUint(1, 32).endCell(), // op: initialize
    }),
  });

  console.log('MBU deployed at:', mbu.address.toString());

  // Deploy MindBurn Reputation Token (MBR)
  const mbrConfig = {
    admin: Address.parse(process.env.ADMIN_ADDRESS!),
    decayRate: 500, // 5% monthly decay
    minVerificationScore: 75,
  };

  const mbr = MindBurnReputation.createFromConfig(
    mbrConfig,
    await loadCode('MindBurnReputation.fc')
  );

  await sender.send({
    to: mbr.address,
    value: toNano('1'),
    init: mbr.init,
    body: internal({
      value: toNano('0.1'),
      body: beginCell().storeUint(1, 32).endCell(), // op: initialize
    }),
  });

  console.log('MBR deployed at:', mbr.address.toString());

  // Deploy MindBurn Governance Token (MBG)
  const mbgConfig = {
    admin: Address.parse(process.env.ADMIN_ADDRESS!),
    proposalThreshold: BigInt(100_000), // 100k tokens
    votingPeriod: 604800, // 7 days
    executionDelay: 172800, // 2 days
    quorumThreshold: 4000, // 40%
  };

  const mbg = MindBurnGovernance.createFromConfig(
    mbgConfig,
    await loadCode('MindBurnGovernance.fc')
  );

  await sender.send({
    to: mbg.address,
    value: toNano('1'),
    init: mbg.init,
    body: internal({
      value: toNano('0.1'),
      body: beginCell().storeUint(1, 32).endCell(), // op: initialize
    }),
  });

  console.log('MBG deployed at:', mbg.address.toString());

  // Initialize token distribution
  await initializeTokenDistribution(mbu, sender);

  console.log('Deployment completed successfully!');
}

async function initializeTokenDistribution(mbu: MindBurnToken, sender: Sender) {
  const distribution = {
    platform: '400000000', // 40% Platform Operations & Rewards
    team: '200000000', // 20% Team & Advisors
    community: '150000000', // 15% Community Development
    treasury: '150000000', // 15% Treasury
    liquidity: '100000000', // 10% Initial Liquidity
  };

  console.log('Initializing token distribution...');

  // Platform Operations allocation
  await mbu.mint(sender.provider!, {
    to: Address.parse(process.env.PLATFORM_OPERATIONS_ADDRESS!),
    amount: BigInt(distribution.platform),
  });

  // Team allocation (with vesting)
  await mbu.mint(sender.provider!, {
    to: Address.parse(process.env.TEAM_VESTING_ADDRESS!),
    amount: BigInt(distribution.team),
  });

  // Community Development
  await mbu.mint(sender.provider!, {
    to: Address.parse(process.env.COMMUNITY_ADDRESS!),
    amount: BigInt(distribution.community),
  });

  // Treasury
  await mbu.mint(sender.provider!, {
    to: Address.parse(process.env.TREASURY_ADDRESS!),
    amount: BigInt(distribution.treasury),
  });

  // Initial Liquidity
  await mbu.mint(sender.provider!, {
    to: Address.parse(process.env.LIQUIDITY_POOL_ADDRESS!),
    amount: BigInt(distribution.liquidity),
  });

  console.log('Token distribution completed!');
}

async function loadCode(filename: string) {
  const contractPath = join(__dirname, '..', 'contracts', filename);
  return await compileFunc({
    path: contractPath,
    targets: ['contracts/stdlib.fc'],
  });
}

// Run deployment
deploy().catch(console.error);
