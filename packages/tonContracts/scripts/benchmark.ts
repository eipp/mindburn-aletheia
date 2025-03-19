import { Address, toNano } from 'ton-core';
import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { WorkerReward } from '../wrappers/WorkerReward';
import { WorkerReputation } from '../wrappers/WorkerReputation';
import { UtilityToken } from '../wrappers/UtilityToken';

interface GasUsage {
  operation: string;
  gasUsed: number;
  description: string;
}

async function measureGas(operation: () => Promise<any>, description: string): Promise<GasUsage> {
  const startGas = await blockchain.getGasUsed();
  await operation();
  const endGas = await blockchain.getGasUsed();

  return {
    operation: description,
    gasUsed: endGas - startGas,
    description,
  };
}

async function runBenchmarks() {
  console.log('Starting gas usage benchmarks...\n');

  const blockchain = await Blockchain.create();
  const owner = await blockchain.treasury('owner');
  const worker = await blockchain.treasury('worker');
  const client = await blockchain.treasury('client');

  // Deploy contracts
  const utilityToken = await deployUtilityToken(blockchain, owner);
  const workerReputation = await deployWorkerReputation(blockchain, owner);
  const workerReward = await deployWorkerReward(blockchain, owner);

  // Configure contracts
  await configureContracts(workerReward, workerReputation, utilityToken, owner);

  const results: GasUsage[] = [];

  // Benchmark WorkerReward operations
  console.log('Benchmarking WorkerReward operations...');
  results.push(
    await measureGas(
      async () =>
        await workerReward.sendCreateTask(
          client.getSender(),
          {
            taskId: 1,
            reward: toNano('10'),
            client: client,
          },
          toNano('10')
        ),
      'Create Task'
    )
  );

  results.push(
    await measureGas(
      async () =>
        await workerReward.sendAssignTask(owner.getSender(), {
          taskId: 1,
          worker: worker,
        }),
      'Assign Task'
    )
  );

  results.push(
    await measureGas(
      async () =>
        await workerReward.sendSubmitVerification(owner.getSender(), {
          taskId: 1,
          qualityScore: 90,
          taskComplexity: 2,
        }),
      'Submit Verification'
    )
  );

  // Benchmark WorkerReputation operations
  console.log('Benchmarking WorkerReputation operations...');
  results.push(
    await measureGas(
      async () =>
        await workerReputation.sendRegisterWorker(owner.getSender(), {
          worker: worker,
        }),
      'Register Worker'
    )
  );

  results.push(
    await measureGas(
      async () =>
        await workerReputation.sendUpdateReputation(owner.getSender(), {
          worker: worker,
          qualityScore: 90,
          taskComplexity: 2,
        }),
      'Update Reputation'
    )
  );

  // Benchmark UtilityToken operations
  console.log('Benchmarking UtilityToken operations...');
  results.push(
    await measureGas(
      async () =>
        await utilityToken.sendTransfer(owner.getSender(), {
          to: worker,
          amount: toNano('100'),
        }),
      'Token Transfer'
    )
  );

  results.push(
    await measureGas(
      async () =>
        await utilityToken.sendStake(worker.getSender(), {
          amount: toNano('1000'),
        }),
      'Token Stake'
    )
  );

  // Benchmark upgrade operations
  console.log('Benchmarking upgrade operations...');
  const newCode = await blockchain.createCode();

  results.push(
    await measureGas(
      async () =>
        await workerReward.sendUpgrade(owner.getSender(), {
          newCode: newCode,
          delay: 3600,
        }),
      'Initiate Upgrade'
    )
  );

  await blockchain.setTime(Date.now() / 1000 + 3601);

  results.push(
    await measureGas(
      async () => await workerReward.sendUpgradeComplete(owner.getSender()),
      'Complete Upgrade'
    )
  );

  // Print results
  console.log('\nGas Usage Benchmark Results:\n');
  console.log('WorkerReward Contract:');
  printResults(
    results.filter(r => ['Create Task', 'Assign Task', 'Submit Verification'].includes(r.operation))
  );

  console.log('\nWorkerReputation Contract:');
  printResults(results.filter(r => ['Register Worker', 'Update Reputation'].includes(r.operation)));

  console.log('\nUtilityToken Contract:');
  printResults(results.filter(r => ['Token Transfer', 'Token Stake'].includes(r.operation)));

  console.log('\nUpgrade Operations:');
  printResults(results.filter(r => ['Initiate Upgrade', 'Complete Upgrade'].includes(r.operation)));
}

function printResults(results: GasUsage[]) {
  results.forEach(result => {
    console.log(`${result.operation}:`);
    console.log(`  Gas Used: ${result.gasUsed.toLocaleString()} gas units`);
    console.log(`  Description: ${result.description}`);
    console.log();
  });
}

async function deployUtilityToken(blockchain: Blockchain, owner: Address) {
  const utilityTokenCode = await UtilityToken.createFromConfig({
    owner: owner,
    admin: owner,
    totalSupply: toNano('1000000'),
    minStake: toNano('1000'),
    lockPeriod: 2592000,
  });
  const utilityToken = blockchain.openContract(utilityTokenCode);
  await utilityToken.sendDeploy(owner.getSender(), toNano('1'));
  return utilityToken;
}

async function deployWorkerReputation(blockchain: Blockchain, owner: Address) {
  const workerReputationCode = await WorkerReputation.createFromConfig({
    owner: owner,
    admin: owner,
    minScore: 50,
    levelThreshold: 100,
  });
  const workerReputation = blockchain.openContract(workerReputationCode);
  await workerReputation.sendDeploy(owner.getSender(), toNano('1'));
  return workerReputation;
}

async function deployWorkerReward(blockchain: Blockchain, owner: Address) {
  const workerRewardCode = await WorkerReward.createFromConfig({
    owner: owner,
    admin: owner,
    minStake: toNano('100'),
    largePaymentThreshold: toNano('1000'),
  });
  const workerReward = blockchain.openContract(workerRewardCode);
  await workerReward.sendDeploy(owner.getSender(), toNano('1'));
  return workerReward;
}

async function configureContracts(
  workerReward: SandboxContract<WorkerReward>,
  workerReputation: SandboxContract<WorkerReputation>,
  utilityToken: SandboxContract<UtilityToken>,
  owner: Address
) {
  await workerReward.sendUpdateConfig(owner.getSender(), {
    reputationContract: workerReputation.address,
    tokenContract: utilityToken.address,
  });

  await workerReputation.sendUpdateConfig(owner.getSender(), {
    rewardContract: workerReward.address,
    tokenContract: utilityToken.address,
  });
}

// Run benchmarks
runBenchmarks().catch(console.error);
