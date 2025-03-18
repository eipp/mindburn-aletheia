import { TonClient, Address } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import BigNumber from 'bignumber.js';
import { ton } from '../utils/ton';

// Create a logger interface to avoid direct dependency
export interface ILogger {
  info(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

export interface PaymentContractInterface {
  sendReward(
    workerAddress: Address, 
    amount: string, 
    taskId: string, 
    signature: string
  ): Promise<{
    txId: string;
    status: string;
    block: string;
  }>;
}

export interface NetworkConfig {
  endpoint: string;
  apiKey?: string;
  network: 'mainnet' | 'testnet';
}

export interface TransactionHistoryItem {
  txId: string;
  timestamp: number;
  amount: string;
  fee: string;
  status: string;
  explorerUrl: string;
}

/**
 * Comprehensive TON service for all Mindburn applications
 */
export class TonService {
  private client: TonClient;
  private paymentContract: PaymentContractInterface | null = null;
  private logger: ILogger;
  private networkConfig: NetworkConfig;

  constructor(
    config: NetworkConfig, 
    logger: ILogger, 
    PaymentContractClass?: new (address: Address, client: TonClient) => PaymentContractInterface
  ) {
    this.networkConfig = config;
    this.logger = logger;
    
    this.client = ton.client.create({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      network: config.network
    });
  }

  /**
   * Initialize a payment contract for sending rewards
   */
  async initPaymentContract(address: string, PaymentContractClass: new (address: Address, client: TonClient) => PaymentContractInterface): Promise<boolean> {
    try {
      if (!ton.validation.address(address)) {
        throw new Error('Invalid payment contract address');
      }
      
      this.paymentContract = new PaymentContractClass(
        Address.parse(address),
        this.client
      );
      return true;
    } catch (error) {
      this.logger.error('Error initializing payment contract:', { error });
      return false;
    }
  }

  /**
   * Send a reward to a worker
   */
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
      this.logger.error('Error sending reward:', { error });
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
      this.logger.error('Error getting balance', { error, address });
      return BigInt(0);
    }
  }
  
  /**
   * Get the explorer URL for a transaction
   */
  getTransactionUrl(txHash: string): string {
    return ton.explorer.getTransactionUrl(txHash, this.networkConfig.network);
  }
  
  /**
   * Get the explorer URL for an address
   */
  getAddressUrl(address: string): string {
    return ton.explorer.getAddressUrl(address, this.networkConfig.network);
  }
  
  /**
   * Validate a withdrawal
   */
  validateWithdrawal(amount: number | string, balance: number | string, minWithdrawal?: number): boolean {
    const result = ton.validation.withdrawal(amount, balance, minWithdrawal);
    return result.isValid;
  }
  
  /**
   * Calculate the fee for a transaction
   */
  calculateFee(amount: number | string): number {
    return ton.calculation.fee(amount).toNumber();
  }

  /**
   * Verify a transaction status
   */
  async verifyTransaction(txId: string) {
    try {
      const tx = await this.client.getTransaction(txId);
      return {
        status: tx.status,
        block: tx.block,
        fee: tx.totalFee.toString(),
      };
    } catch (error) {
      this.logger.error('Error verifying transaction:', { error });
      throw new Error('Failed to verify transaction');
    }
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address: string, limit = 10): Promise<TransactionHistoryItem[]> {
    try {
      if (!ton.validation.address(address)) {
        throw new Error('Invalid TON address');
      }
      
      const history = await this.client.getTransactions(
        Address.parse(address),
        limit
      );
      
      return history.map((tx) => ({
        txId: tx.txId,
        timestamp: tx.timestamp,
        amount: tx.amount.toString(),
        fee: tx.totalFee.toString(),
        status: tx.status,
        explorerUrl: this.getTransactionUrl(tx.txId)
      }));
    } catch (error) {
      this.logger.error('Error getting transaction history:', { error });
      throw new Error('Failed to get transaction history');
    }
  }
}

/**
 * Create a TonService instance with the specified configuration
 */
export function createTonService(
  config: NetworkConfig,
  logger: ILogger,
  PaymentContractClass?: new (address: Address, client: TonClient) => PaymentContractInterface
): TonService {
  return new TonService(config, logger, PaymentContractClass);
} 