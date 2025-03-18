import { TonNetworkConfig } from '@mindburn/shared';

/**
 * TON configuration for worker-webapp
 */
export const tonConfig = {
  // Network configuration
  network: import.meta.env.VITE_TON_NETWORK || 'mainnet',
  endpoint: import.meta.env.VITE_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: import.meta.env.VITE_TON_API_KEY || '',

  // Transaction settings
  minWithdrawalAmount: 1, // Minimum withdrawal amount in TON
  maxWithdrawalAmount: 1000, // Maximum withdrawal amount in TON
  defaultFee: 0.01, // Default transaction fee in TON

  // Explorer URLs
  mainnetExplorer: 'https://tonscan.org',
  testnetExplorer: 'https://testnet.tonscan.org',

  // Reward multipliers
  rewardMultipliers: {
    quality: {
      min: 0.5,
      max: 1.5,
    },
    speed: {
      min: 1.0,
      max: 2.0,
    },
    complexity: {
      min: 1.0,
      max: 3.0,
    },
    urgency: {
      min: 1.0,
      max: 2.5,
    },
  },
};

/**
 * Get TON network configuration for TonService
 */
export function getTonNetworkConfig(): TonNetworkConfig {
  return {
    endpoint: tonConfig.endpoint,
    apiKey: tonConfig.apiKey,
    network: tonConfig.network as 'mainnet' | 'testnet',
  };
}
