import { Address, Contract, ContractProvider } from '@ton/core';
import { MindBurnToken } from '../contracts/MindBurnToken';
import { MindBurnReputation } from '../contracts/MindBurnReputation';
import BigNumber from 'bignumber.js';

export interface VerificationResult {
  workerId: string;
  taskId: string;
  accuracy: number;
  timeSpent: number;
  complexity: number;
}

export class VerificationRewards {
  private readonly utilityToken: MindBurnToken;
  private readonly reputationToken: MindBurnReputation;
  private readonly provider: ContractProvider;

  constructor(
    utilityToken: MindBurnToken,
    reputationToken: MindBurnReputation,
    provider: ContractProvider
  ) {
    this.utilityToken = utilityToken;
    this.reputationToken = reputationToken;
    this.provider = provider;
  }

  async processVerification(result: VerificationResult): Promise<{
    tokenReward: bigint;
    reputationChange: number;
  }> {
    const workerAddress = Address.parse(result.workerId);
    
    // Calculate base reward
    const baseReward = this.calculateBaseReward(result);
    
    // Get reputation multiplier
    const reputationMultiplier = await this.reputationToken.getReputationMultiplier(
      this.provider,
      workerAddress
    );

    // Calculate final reward
    const finalReward = BigInt(
      Math.floor(Number(baseReward) * reputationMultiplier)
    );

    // Calculate reputation change
    const reputationChange = this.calculateReputationChange(result);

    // Update reputation
    await this.reputationToken.updateReputation(this.provider, {
      worker: workerAddress,
      verificationScore: result.accuracy,
    });

    // Distribute token rewards
    if (finalReward > 0n) {
      await this.utilityToken.transfer(this.provider, {
        to: workerAddress,
        amount: finalReward,
      });
    }

    return {
      tokenReward: finalReward,
      reputationChange,
    };
  }

  private calculateBaseReward(result: VerificationResult): bigint {
    const MIN_ACCURACY = 75;
    const MAX_REWARD = BigInt(50_000_000); // 50 MBU

    if (result.accuracy < MIN_ACCURACY) {
      return 0n;
    }

    // Base calculation considering accuracy
    const accuracyFactor = (result.accuracy - MIN_ACCURACY) / (100 - MIN_ACCURACY);
    
    // Complexity factor (0.5 to 2.0)
    const complexityFactor = 0.5 + (result.complexity * 1.5);
    
    // Time efficiency factor (inversely proportional to time spent)
    const expectedTime = 300; // 5 minutes in seconds
    const timeEfficiencyFactor = Math.min(
      2.0,
      Math.max(0.5, expectedTime / result.timeSpent)
    );

    const finalFactor =
      accuracyFactor * complexityFactor * timeEfficiencyFactor;
    
    return BigInt(Math.floor(Number(MAX_REWARD) * finalFactor));
  }

  private calculateReputationChange(result: VerificationResult): number {
    const MIN_ACCURACY = 75;
    const BASE_POINTS = 10;
    const MAX_POINTS = 50;

    if (result.accuracy < MIN_ACCURACY) {
      return -BASE_POINTS;
    }

    const accuracyFactor = (result.accuracy - MIN_ACCURACY) / (100 - MIN_ACCURACY);
    const complexityBonus = result.complexity * MAX_POINTS * 0.5;
    
    return Math.floor(BASE_POINTS + (accuracyFactor * MAX_POINTS) + complexityBonus);
  }

  async applyStakingRewards(
    worker: Address,
    stakedAmount: bigint,
    stakingPeriod: number
  ): Promise<bigint> {
    const DAILY_RATE = 0.0005; // 0.05% daily
    const daysStaked = stakingPeriod / 86400; // Convert seconds to days
    
    const rewardAmount = BigInt(
      Math.floor(
        Number(stakedAmount) * Math.pow(1 + DAILY_RATE, daysStaked) -
          Number(stakedAmount)
      )
    );

    if (rewardAmount > 0n) {
      await this.utilityToken.transfer(this.provider, {
        to: worker,
        amount: rewardAmount,
      });
    }

    return rewardAmount;
  }

  async applyPenalty(
    worker: Address,
    penaltyAmount: bigint,
    reason: string
  ): Promise<void> {
    // Burn penalized tokens
    await this.utilityToken.burn(this.provider, {
      amount: penaltyAmount,
    });

    // Reduce reputation
    const currentReputation = await this.reputationToken.getWorkerReputation(
      this.provider,
      worker
    );
    
    const penaltyScore = Math.max(0, currentReputation - 50);
    await this.reputationToken.updateReputation(this.provider, {
      worker,
      verificationScore: penaltyScore,
    });
  }
} 