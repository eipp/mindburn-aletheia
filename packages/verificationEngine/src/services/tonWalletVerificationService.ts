import { TonClient, Address, fromNano } from '@ton/ton';
import { Logger } from '@mindburn/shared/logger';
import { WalletVerification } from '../types';

export class TonWalletVerificationService {
  private readonly tonClient: TonClient;
  private readonly logger: Logger;
  private readonly minRequiredBalance: string;

  constructor(
    tonClient: TonClient,
    logger: Logger,
    minRequiredBalance: string = '0.1' // Default 0.1 TON
  ) {
    this.tonClient = tonClient;
    this.logger = logger.child({ service: 'TonWalletVerification' });
    this.minRequiredBalance = minRequiredBalance;
  }

  async verifyWallet(address: string): Promise<WalletVerification> {
    try {
      // Validate address format
      if (!this.isValidAddress(address)) {
        throw new Error('Invalid TON wallet address format');
      }

      // Convert to Address type
      const walletAddress = Address.parse(address);

      // Check if wallet exists and get balance
      const balance = await this.tonClient.getBalance(walletAddress);
      const balanceInTon = fromNano(balance);

      // Check if balance meets minimum requirement
      const hasMinBalance = parseFloat(balanceInTon) >= parseFloat(this.minRequiredBalance);

      // Get wallet contract info
      const contractInfo = await this.tonClient.getContractState(walletAddress);
      const isActive = contractInfo.state === 'active';

      const verification: WalletVerification = {
        address,
        verified: isActive && hasMinBalance,
        balance: balanceInTon,
        lastChecked: new Date().toISOString(),
        metadata: {
          contractState: contractInfo.state,
          hasMinBalance,
          minRequired: this.minRequiredBalance,
        },
      };

      this.logger.info('Wallet verification completed', {
        address,
        verified: verification.verified,
        balance: verification.balance,
      });

      return verification;
    } catch (error) {
      this.logger.error('Wallet verification failed', {
        error,
        address,
      });
      throw error;
    }
  }

  async monitorWalletActivity(
    address: string,
    callback: (activity: any) => Promise<void>
  ): Promise<void> {
    try {
      const walletAddress = Address.parse(address);

      // Subscribe to transactions
      const subscription = this.tonClient.createSubscription({
        address: walletAddress,
        event: 'message',
      });

      subscription.on('message', async message => {
        try {
          await callback({
            type: 'transaction',
            timestamp: new Date().toISOString(),
            data: message,
          });
        } catch (error) {
          this.logger.error('Error processing wallet activity', {
            error,
            address,
            message,
          });
        }
      });

      this.logger.info('Started monitoring wallet activity', { address });
    } catch (error) {
      this.logger.error('Failed to start wallet monitoring', {
        error,
        address,
      });
      throw error;
    }
  }

  async validateTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string,
    message?: string
  ): Promise<boolean> {
    try {
      // Convert addresses
      const from = Address.parse(fromAddress);
      const to = Address.parse(toAddress);

      // Get sender balance
      const balance = await this.tonClient.getBalance(from);
      const balanceInTon = fromNano(balance);

      // Check if sender has sufficient balance
      if (parseFloat(balanceInTon) < parseFloat(amount)) {
        this.logger.warn('Insufficient balance for transaction', {
          fromAddress,
          balance: balanceInTon,
          amount,
        });
        return false;
      }

      // Validate recipient
      const recipientState = await this.tonClient.getContractState(to);
      if (recipientState.state !== 'active') {
        this.logger.warn('Recipient wallet not active', {
          toAddress,
          state: recipientState.state,
        });
        return false;
      }

      this.logger.info('Transaction validation successful', {
        fromAddress,
        toAddress,
        amount,
      });

      return true;
    } catch (error) {
      this.logger.error('Transaction validation failed', {
        error,
        fromAddress,
        toAddress,
        amount,
      });
      throw error;
    }
  }

  private isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }
}
