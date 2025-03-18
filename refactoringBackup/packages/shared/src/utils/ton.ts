import { Address } from '@ton/core';
import BigNumber from 'bignumber.js';
import { TonClient } from '@ton/ton';

export interface TransactionData {
  amount: number | string;
  address: string;
  balance: number | string;
  minWithdrawal?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  REWARD = 'REWARD',
  FEE = 'FEE'
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  taskId?: string;
  createdAt: number;
  updatedAt: number;
  hash?: string;
}

export interface TonNetworkConfig {
  endpoint: string;
  apiKey?: string;
  network: 'mainnet' | 'testnet';
}

// Default network configuration
export const DEFAULT_MAINNET_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';
export const DEFAULT_TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';

/**
 * Comprehensive TON utilities
 */
export const ton = {
  validation: {
    /**
     * Validates a TON address
     */
    address: (address: string): boolean => {
      try {
        new Address(address);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Validates transaction data
     */
    transaction: (data: TransactionData): ValidationResult => {
      const errors: string[] = [];
      const amount = new BigNumber(data.amount);
      const balance = new BigNumber(data.balance);
      const fee = ton.calculation.fee(amount);
      const totalAmount = amount.plus(fee);

      if (amount.lte(0)) {
        errors.push('Invalid amount');
      }

      if (!ton.validation.address(data.address)) {
        errors.push('Invalid TON address');
      }

      if (totalAmount.gt(balance)) {
        errors.push(`Insufficient balance. Total required: ${ton.format.amount(totalAmount)} TON (including fee)`);
      }

      if (data.minWithdrawal && amount.lt(data.minWithdrawal)) {
        errors.push(`Minimum withdrawal amount is ${data.minWithdrawal} TON`);
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    },

    /**
     * Validates a withdrawal
     */
    withdrawal: (amount: number | string, balance: number | string, minWithdrawal: number = 1): ValidationResult => {
      const amountBN = new BigNumber(amount);
      const balanceBN = new BigNumber(balance);
      const errors: string[] = [];

      if (amountBN.lte(0)) {
        errors.push('Amount must be greater than 0');
      }

      if (amountBN.lt(minWithdrawal)) {
        errors.push(`Minimum withdrawal amount is ${minWithdrawal} TON`);
      }

      const fee = ton.calculation.fee(amountBN);
      const totalAmount = amountBN.plus(fee);

      if (totalAmount.gt(balanceBN)) {
        errors.push('Insufficient balance including fee');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }
  },

  format: {
    /**
     * Formats a TON amount for display
     */
    amount: (amount: number | string | BigNumber): string => {
      const bn = new BigNumber(amount);
      return bn.toFormat(9) + ' TON';
    },

    /**
     * Formats a transaction status for display
     */
    transactionStatus: (status: string): string => {
      const statusMap: Record<string, string> = {
        pending: 'Pending',
        completed: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled'
      };
      return statusMap[status.toLowerCase()] || status;
    },

    /**
     * Formats a transaction type for display
     */
    transactionType: (type: string): string => {
      const typeMap: Record<string, string> = {
        deposit: 'Deposit',
        withdrawal: 'Withdrawal',
        reward: 'Reward',
        fee: 'Fee'
      };
      return typeMap[type.toLowerCase()] || type;
    }
  },

  parse: {
    /**
     * Parses a TON amount string to a BigNumber
     */
    amount: (amount: string): BigNumber | null => {
      try {
        const cleaned = amount.replace(/[^0-9.]/g, '');
        return new BigNumber(cleaned);
      } catch {
        return null;
      }
    }
  },

  calculation: {
    /**
     * Calculates the transaction fee for a given amount
     */
    fee: (amount: number | string | BigNumber): BigNumber => {
      // Standard TON fee calculation
      const amountBN = new BigNumber(amount);
      return amountBN.multipliedBy(0.001).plus(0.01); // 0.1% + 0.01 TON base fee
    }
  },

  explorer: {
    /**
     * Gets the explorer URL for a transaction
     */
    getTransactionUrl: (txHash: string, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
      const baseUrl = network === 'mainnet'
        ? 'https://tonscan.org'
        : 'https://testnet.tonscan.org';
      return `${baseUrl}/tx/${txHash}`;
    },

    /**
     * Gets the explorer URL for an address
     */
    getAddressUrl: (address: string, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
      const baseUrl = network === 'mainnet'
        ? 'https://tonscan.org'
        : 'https://testnet.tonscan.org';
      return `${baseUrl}/address/${address}`;
    }
  },

  client: {
    /**
     * Creates a new TonClient instance
     */
    create: (config?: Partial<TonNetworkConfig>): TonClient => {
      const defaultConfig: TonNetworkConfig = {
        endpoint: config?.network === 'testnet' ? DEFAULT_TESTNET_ENDPOINT : DEFAULT_MAINNET_ENDPOINT,
        network: 'mainnet'
      };

      const mergedConfig = { ...defaultConfig, ...config };

      return new TonClient({
        endpoint: mergedConfig.endpoint,
        apiKey: mergedConfig.apiKey
      });
    },

    /**
     * Gets the balance of an address
     */
    getBalance: async (address: string, client?: TonClient): Promise<bigint> => {
      try {
        if (!ton.validation.address(address)) {
          throw new Error('Invalid TON address');
        }

        const tonClient = client || ton.client.create();
        return await tonClient.getBalance(address);
      } catch (error) {
        console.error('Error getting balance:', error);
        return BigInt(0);
      }
    }
  }
};

// Legacy exports for backward compatibility
export const validateTonAddress = ton.validation.address;

export const formatTonAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseTonAmount = (amount: string): number | null => {
  try {
    const cleanAmount = amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanAmount);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};

export const calculateFee = (amount: number): number => {
  // TON transfer fee is typically 0.01 TON
  return 0.01;
};

export const getTransactionExplorerUrl = (txHash: string, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
  return ton.explorer.getTransactionUrl(txHash, network);
};

export const validateTransactionData = (data: {
  amount: number;
  address: string;
  balance: number;
  minWithdrawal?: number;
}): ValidationResult => {
  return ton.validation.transaction({
    amount: data.amount,
    address: data.address,
    balance: data.balance,
    minWithdrawal: data.minWithdrawal
  });
}; 