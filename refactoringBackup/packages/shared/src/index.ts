// Core types
export * from './types/core';

// TON utilities
export { ton } from './utils/ton';
export type { 
  TransactionData, 
  ValidationResult as TONValidationResult,
  TransactionType,
  TransactionStatus,
  Transaction,
  TonNetworkConfig
} from './utils/ton';

// Configuration utilities
export {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator
} from './config/validator';
export type {
  ValidationResult as ConfigValidationResult,
  ConfigValidator,
  ConfigValidatorOptions
} from './config/validator';

// Re-export commonly used dependencies to ensure version consistency
export { Address } from '@ton/core';
export { BigNumber } from 'bignumber.js';

// Export logging utilities
export { createLogger } from './utils/logging/logger';
export type { LogContext } from './utils/logging/logger';

// Export verification service
export { VerificationService } from './services/verification';
export type { 
  VerificationOptions, 
  VerificationRequest, 
  VerificationResult 
} from './services/verification';

// Export fraud detection
export { FraudDetector } from './utils/fraud-detector';
export type { 
  FraudCheckOptions, 
  FraudCheckResult 
} from './utils/fraud-detector';

// Export TON service
export { TonService, createTonService } from './services/ton';
export type {
  ILogger as TonServiceLogger,
  PaymentContractInterface,
  NetworkConfig as TonNetworkConfig,
  TransactionHistoryItem
} from './services/ton';

// Payment types
export interface PaymentResult {
  success: boolean;
  txId?: string;
  amount?: BigNumber;
  fee?: BigNumber;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}