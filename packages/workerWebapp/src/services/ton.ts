import { Address } from '@ton/ton';
import {
  TonService,
  createTonService,
  TonServiceLogger,
  PaymentContractInterface,
} from '@mindburn/shared';
import { PaymentContract } from '@/contracts/payment';
import { getTonNetworkConfig } from '@/config/ton';
import logger from '../utils/logger';

/**
 * TON service for worker-webapp
 * This is a thin wrapper around the shared TON utilities
 * with worker-webapp specific functionality
 */
export class TonService {
  private client: ReturnType<typeof ton.client.create>;
  private paymentContract: PaymentContract | null = null;

  constructor() {
    this.client = ton.client.create({
      endpoint: import.meta.env.VITE_TON_ENDPOINT,
      apiKey: import.meta.env.VITE_TON_API_KEY,
      network: (import.meta.env.VITE_TON_NETWORK as 'mainnet' | 'testnet') || 'mainnet',
    });
  }

  async initPaymentContract(address: string) {
    try {
      if (!ton.validation.address(address)) {
        throw new Error('Invalid payment contract address');
      }

      this.paymentContract = new PaymentContract(Address.parse(address), this.client);
      return true;
    } catch (error) {
      console.error('Error initializing payment contract:', error);
      return false;
    }
  }

  async sendReward({
    workerAddress,
    amount,
    taskId,
    signature,
  }: {
    workerAddress: string;
    amount: string;
    taskId: string;
    signature: string;
  }) {
    if (!this.paymentContract) {
      throw new Error('Payment contract not initialized');
    }

    if (!ton.validation.address(workerAddress)) {
      throw new Error('Invalid worker address');
    }

    try {
      const tx = await this.paymentContract.sendReward(
        Address.parse(workerAddress),
        amount,
        taskId,
        signature
      );

      return {
        txId: tx.txId,
        status: tx.status,
        block: tx.block,
      };
    } catch (error) {
      console.error('Error sending reward:', error);
      throw new Error('Failed to send reward');
    }
  }

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
      return await ton.client.getBalance(address, this.client);
    } catch (error) {
      logger.error('Error getting balance', { error, address });
      return BigInt(0);
    }
  }

  /**
   * Get the explorer URL for a transaction
   */
  getTransactionUrl(txHash: string): string {
    return ton.explorer.getTransactionUrl(
      txHash,
      (import.meta.env.VITE_TON_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
    );
  }

  /**
   * Get the explorer URL for an address
   */
  getAddressUrl(address: string): string {
    return ton.explorer.getAddressUrl(
      address,
      (import.meta.env.VITE_TON_NETWORK as 'mainnet' | 'testnet') || 'mainnet'
    );
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

  async verifyTransaction(txId: string) {
    try {
      const tx = await this.client.getTransaction(txId);
      return {
        status: tx.status,
        block: tx.block,
        fee: tx.totalFee.toString(),
      };
    } catch (error) {
      console.error('Error verifying transaction:', error);
      throw new Error('Failed to verify transaction');
    }
  }

  async getTransactionHistory(address: string, limit = 10) {
    try {
      if (!ton.validation.address(address)) {
        throw new Error('Invalid TON address');
      }

      const history = await this.client.getTransactions(Address.parse(address), limit);
      return history.map(tx => ({
        txId: tx.txId,
        timestamp: tx.timestamp,
        amount: tx.amount.toString(),
        fee: tx.totalFee.toString(),
        status: tx.status,
        explorerUrl: this.getTransactionUrl(tx.txId),
      }));
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw new Error('Failed to get transaction history');
    }
  }
}

// Create a logger adapter that implements the TonServiceLogger interface
const loggerAdapter: TonServiceLogger = {
  info: (message, meta) => logger.info(message, meta),
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
};

// Create a TonService instance with worker-webapp specific configuration
const tonService = createTonService(
  getTonNetworkConfig(),
  loggerAdapter,
  PaymentContract as unknown as new (address: Address, client: any) => PaymentContractInterface
);

// Initialize the payment contract if an address is available
if (import.meta.env.VITE_PAYMENT_CONTRACT_ADDRESS) {
  tonService
    .initPaymentContract(
      import.meta.env.VITE_PAYMENT_CONTRACT_ADDRESS,
      PaymentContract as unknown as new (address: Address, client: any) => PaymentContractInterface
    )
    .then(success => {
      if (success) {
        logger.info('Payment contract initialized successfully');
      } else {
        logger.error('Failed to initialize payment contract');
      }
    });
}

// Export the TonService instance
export { tonService };

// Re-export the TonService class for extension if needed
export { TonService };
