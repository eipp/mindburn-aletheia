import { BigNumber } from 'bignumber.js';

export interface Worker {
    id: string;
    reputation: number;
    skillLevel: number;
    stakedAmount: BigNumber;
    earnedTokens: BigNumber;
    completedTasks: number;
    successRate: number;
    lastActive: number;
}

export interface Task {
    id: string;
    complexity: number;
    reward: BigNumber;
    requiredReputation: number;
}

export interface TokenState {
    totalMBUSupply: BigNumber;
    circulatingMBU: BigNumber;
    totalStaked: BigNumber;
    treasuryBalance: BigNumber;
    burnedTokens: BigNumber;
}

export interface SimulationParams {
    baseTasksPerDay: number;
    dailyGrowthRate: number;
    dailyBurnRate: number;
    dailyStakingReward: number;
    treasuryGrowthRate: number;
    initialWorkers: number;
    workerGrowthRate: number;
}

export interface VerificationResult {
    accuracy: number;
    reward: BigNumber;
    reputationChange: number;
}

export interface EconomicMetrics {
    tokenPrice: BigNumber;
    marketCap: BigNumber;
    stakingAPY: number;
    treasuryGrowth: number;
    burnRate: number;
}

export interface ReputationMetrics {
    averageReputation: number;
    reputationDistribution: Map<number, number>;
    topPerformers: Worker[];
    averageAccuracy: number;
}

export interface WorkerMetrics {
    totalWorkers: number;
    activeWorkers: number;
    averageEarnings: BigNumber;
    taskCompletionRate: number;
    stakingParticipation: number;
}

export interface GovernanceMetrics {
    proposalCount: number;
    voterParticipation: number;
    executedProposals: number;
    treasuryUtilization: number;
}

export interface SimulationResult {
    economic: EconomicMetrics;
    reputation: ReputationMetrics;
    worker: WorkerMetrics;
    governance: GovernanceMetrics;
    finalTokenState: TokenState;
} 