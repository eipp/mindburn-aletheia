import { readFileSync } from 'fs';
import { join } from 'path';
import { Cell } from '@ton/core';
import { compileFunc } from '@ton/blueprint';
import { Contract } from '@ton/core';
import { TonClient } from '@ton/ton';

export async function loadTestCode(filename: string): Promise<Cell> {
  const contractPath = join(__dirname, '..', 'contracts', filename);
  const code = await compileFunc({
    path: contractPath,
    targets: ['contracts/stdlib.fc'],
  });
  return code;
}

export async function deployContract(contract: Contract, client: TonClient) {
  const state = await contract.createStateInit();
  const address = contract.address;
  
  // Deploy contract
  await client.sendExternalMessage(contract, {
    body: Cell.EMPTY,
    stateInit: state,
  });

  // Wait for deployment
  let attempts = 0;
  while (attempts < 10) {
    const deployed = await client.isContractDeployed(address);
    if (deployed) return;
    await new Promise(resolve => setTimeout(resolve, 1500));
    attempts++;
  }
  throw new Error('Contract deployment timeout');
}

export async function advanceTime(seconds: number, client: TonClient) {
  // For testnet, we can use a special debug RPC call
  if (client.isTestnet()) {
    await client.debug.advanceTime(seconds);
    return;
  }
  
  // For local node, we can manipulate the node's time
  await client.setTime(Math.floor(Date.now() / 1000) + seconds);
}

export function createTestParameters() {
  return {
    parameterType: 'SYSTEM_PARAMETER',
    key: 'minStakeAmount',
    value: '1000000000', // 1000 tokens
    description: 'Update minimum stake amount',
  };
}

export function createTestProposal() {
  return {
    description: 'Test proposal for parameter change',
    type: 'PARAMETER_CHANGE',
    parameters: createTestParameters(),
    metadata: {
      title: 'Update Minimum Stake',
      discussion: 'https://forum.mindburn.org/t/123',
      author: 'EQD...',
    },
  };
}

export function mockVerificationResult(
  workerId: string,
  accuracy: number = 95,
  timeSpent: number = 300,
  complexity: number = 0.8
) {
  return {
    workerId,
    taskId: `task_${Date.now()}`,
    accuracy,
    timeSpent,
    complexity,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export function calculateExpectedReward(
  accuracy: number,
  timeSpent: number,
  complexity: number,
  baseReward: bigint = BigInt(100)
): bigint {
  const accuracyMultiplier = accuracy / 100;
  const timeMultiplier = Math.min(timeSpent / 300, 1.5);
  const complexityMultiplier = 1 + (complexity * 0.5);
  
  const totalMultiplier = accuracyMultiplier * timeMultiplier * complexityMultiplier;
  return BigInt(Math.floor(Number(baseReward) * totalMultiplier));
}

export function calculateExpectedReputation(
  accuracy: number,
  previousReputation: number = 0,
  decayRate: number = 500 // 5% decay
): number {
  const reputationGain = accuracy - 75; // Minimum verification score is 75
  const decayAmount = (previousReputation * decayRate) / 10000;
  return Math.max(0, previousReputation - decayAmount + reputationGain);
}

export async function waitForTransaction(
  client: TonClient,
  address: string,
  timeout: number = 30000
) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const transactions = await client.getTransactions(address, { limit: 1 });
    if (transactions.length > 0) return transactions[0];
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Transaction timeout');
} 