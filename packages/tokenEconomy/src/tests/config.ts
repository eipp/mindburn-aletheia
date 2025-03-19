export const TEST_CONFIG = {
  network: {
    endpoint: 'https://sandbox.tonhubapi.com/jsonRPC',
    testMnemonic: 'test test test test test test',
  },

  tokens: {
    mbu: {
      totalSupply: BigInt(1_000_000_000),
      decimals: 9,
      baseReward: BigInt(100),
    },

    mbr: {
      decayRate: 500, // 5% decay
      minVerificationScore: 75,
      maxLevel: 5,
      levelThresholds: [0, 100, 250, 500, 1000],
    },

    mbg: {
      proposalThreshold: BigInt(100_000),
      votingPeriod: 604800, // 1 week
      executionDelay: 172800, // 2 days
      quorumThreshold: 4000, // 40%
    },
  },

  verification: {
    baseTimeLimit: 300, // 5 minutes
    maxTimeMultiplier: 1.5,
    complexityMultipliers: {
      low: 1.0,
      medium: 1.25,
      high: 1.5,
    },
    accuracyThresholds: {
      min: 75,
      excellent: 95,
    },
  },

  staking: {
    minAmount: BigInt(1000),
    maxAmount: BigInt(1_000_000),
    minDuration: 86400, // 1 day
    maxDuration: 31536000, // 1 year
    baseAPY: 500, // 5% APY
    bonusAPY: 1000, // Additional 10% for max duration
  },

  penalties: {
    reputationPenalty: 50,
    stakePenalty: 1000, // 10% of staked amount
    banThreshold: 3, // Number of penalties before ban
  },

  timeouts: {
    deployment: 30000,
    transaction: 15000,
    verification: 5000,
  },

  testAddresses: {
    deployer: 'EQD...',
    treasury: 'EQD...',
    worker1: 'EQD...',
    worker2: 'EQD...',
    validator1: 'EQD...',
    validator2: 'EQD...',
  },
} as const;

export type TestConfig = typeof TEST_CONFIG;

export function getTestAddress(key: keyof typeof TEST_CONFIG.testAddresses): string {
  return TEST_CONFIG.testAddresses[key];
}

export function getTokenConfig<T extends keyof typeof TEST_CONFIG.tokens>(
  token: T
): (typeof TEST_CONFIG.tokens)[T] {
  return TEST_CONFIG.tokens[token];
}

export function getVerificationConfig(): typeof TEST_CONFIG.verification {
  return TEST_CONFIG.verification;
}

export function getStakingConfig(): typeof TEST_CONFIG.staking {
  return TEST_CONFIG.staking;
}

export function getPenaltyConfig(): typeof TEST_CONFIG.penalties {
  return TEST_CONFIG.penalties;
}

export function getTimeoutConfig(): typeof TEST_CONFIG.timeouts {
  return TEST_CONFIG.timeouts;
}
