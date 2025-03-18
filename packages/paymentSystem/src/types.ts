import { Address } from '@ton/ton';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

export interface PaymentTransaction {
  paymentId: string;
  recipientAddress: string;
  amount: number;
  referenceId?: string;
  metadata?: Record<string, any>;
  status: PaymentStatus;
  error?: string;
  processedAt?: string;
  createdAt: string;
}

export interface PaymentBatch {
  batchId: string;
  status: PaymentStatus;
  successful: PaymentTransaction[];
  failed: PaymentTransaction[];
  totalAmount: number;
  processedAt: string;
  error?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  status: TransactionStatus;
  gasUsed: bigint;
  timestamp: string;
}

export interface GasEstimate {
  total: bigint;
  breakdown: {
    forward: bigint;
    storage: bigint;
    gas: bigint;
    inForward: bigint;
  };
}

export interface WalletConfig {
  mnemonic: string;
  workchain?: number;
  index?: number;
}

export interface PaymentOptions {
  maxRetries?: number;
  timeoutMs?: number;
  gasLimit?: bigint;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface BatchProcessingResult {
  successful: PaymentTransaction[];
  failed: PaymentTransaction[];
  totalProcessed: number;
  totalAmount: number;
  errors: Error[];
}

export interface PaymentMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalAmount: number;
  averageGasUsed: bigint;
  averageConfirmationTime: number;
}

export interface PaymentFilter {
  status?: PaymentStatus[];
  fromDate?: string;
  toDate?: string;
  recipientAddress?: string;
  minAmount?: number;
  maxAmount?: number;
  referenceId?: string;
} 