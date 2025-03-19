import { TonService, createTonService, TonServiceLogger } from '@mindburn/shared';
import logger from '../utils/logger';

/**
 * TON service for worker-bot
 * This is a thin wrapper around the shared TON utilities
 * with worker-bot specific functionality
 */
export class TonService {
  /**
   * Validate a TON address
   */
  validateAddress(address: string): boolean {
    return ton.validation.address(address);
  }

  /**
   * Format a TON amount for display
   */
  formatAmount(amount: number | string): string {
    return ton.format.amount(amount);
  }

  /**
   * Get the balance of a TON address
   */
  async getBalance(address: string): Promise<bigint> {
    try {
      return await ton.client.getBalance(address);
    } catch (error) {
      logger.error('Error getting balance', { error, address });
      return BigInt(0);
    }
  }

  /**
   * Get the explorer URL for a transaction
   */
  getTransactionUrl(txHash: string): string {
    return ton.explorer.getTransactionUrl(txHash);
  }

  /**
   * Get the explorer URL for an address
   */
  getAddressUrl(address: string): string {
    return ton.explorer.getAddressUrl(address);
  }

  /**
   * Validate a withdrawal
   */
  validateWithdrawal(amount: number | string, balance: number | string): boolean {
    const result = ton.validation.withdrawal(amount, balance);
    return result.isValid;
  }

  /**
   * Calculate the fee for a transaction
   */
  calculateFee(amount: number | string): number {
    return ton.calculation.fee(amount).toNumber();
  }
}

// Create a logger adapter that implements the TonServiceLogger interface
const loggerAdapter: TonServiceLogger = {
  info: (message, meta) => logger.info(message, meta),
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
};

// Create a TonService instance with worker-bot specific configuration
const tonService = createTonService(
  {
    endpoint: process.env.TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY,
    network: (process.env.TON_NETWORK as 'mainnet' | 'testnet') || 'mainnet',
  },
  loggerAdapter
);

// Export the TonService instance
export { tonService };

// Re-export the TonService class for extension if needed
export { TonService };
