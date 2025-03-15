import { TonClient, WalletContractV4, Address } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { PaymentContract } from '@/contracts/payment';

const NETWORK_ENDPOINT = import.meta.env.VITE_TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
const API_KEY = import.meta.env.VITE_TON_API_KEY;

class TonService {
  private client: TonClient;
  private paymentContract: PaymentContract | null = null;

  constructor() {
    this.client = new TonClient({
      endpoint: NETWORK_ENDPOINT,
      apiKey: API_KEY,
    });
  }

  async initPaymentContract(address: string) {
    try {
      this.paymentContract = new PaymentContract(
        Address.parse(address),
        this.client
      );
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

  async getBalance(address: string) {
    try {
      const balance = await this.client.getBalance(Address.parse(address));
      return balance.toString();
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
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
      }));
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw new Error('Failed to get transaction history');
    }
  }
}

export const tonService = new TonService(); 