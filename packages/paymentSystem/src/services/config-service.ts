import { createLogger } from '@mindburn/shared';
import { WalletConfig } from '../types';
import { SSM } from 'aws-sdk';

const logger = createLogger('ConfigService');

/**
 * Service for managing configuration settings for the payment system
 */
export class ConfigService {
  private ssm: SSM;
  private env: string;
  
  // Default TON network endpoint for mainnet
  private readonly DEFAULT_TON_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';
  
  constructor() {
    this.ssm = new SSM();
    this.env = process.env.STAGE || 'dev';
  }
  
  /**
   * Get the TON blockchain endpoint URL
   */
  getTonEndpoint(): string {
    return process.env.TON_ENDPOINT || this.DEFAULT_TON_ENDPOINT;
  }
  
  /**
   * Get the wallet configuration
   */
  getWalletConfig(): WalletConfig {
    // In production, retrieve these values from SSM Parameter Store
    // For now, use environment variables with defaults for testing
    return {
      address: process.env.WALLET_ADDRESS || '',
      mnemonic: process.env.WALLET_MNEMONIC || '',
      publicKey: process.env.WALLET_PUBLIC_KEY || '',
    };
  }
  
  /**
   * Get the maximum allowed payment amount in TON
   */
  getMaxPaymentAmount(): number {
    return parseFloat(process.env.MAX_PAYMENT_AMOUNT || '10');
  }
  
  /**
   * Get the minimum allowed payment amount in TON
   */
  getMinPaymentAmount(): number {
    return parseFloat(process.env.MIN_PAYMENT_AMOUNT || '0.01');
  }
  
  /**
   * Get the maximum batch size (number of payments per batch)
   */
  getMaxBatchSize(): number {
    return parseInt(process.env.MAX_BATCH_SIZE || '50', 10);
  }
  
  /**
   * Get a parameter from SSM Parameter Store
   */
  async getSecureParameter(paramName: string): Promise<string> {
    try {
      const fullPath = `/mindburn/${this.env}/${paramName}`;
      logger.info(`Retrieving parameter: ${fullPath}`);
      
      const response = await this.ssm.getParameter({
        Name: fullPath,
        WithDecryption: true
      }).promise();
      
      return response.Parameter?.Value || '';
    } catch (error) {
      logger.error(`Failed to retrieve parameter: ${paramName}`, { error });
      throw error;
    }
  }
} 