import { TonClient, WalletContractV4, internal } from 'ton';
import { mnemonicToPrivateKey } from 'ton-crypto';
import { validateTonAddress, calculateFee } from '../utils/wallet';

export interface Transaction {
  id: string;
  type: 'reward' | 'withdrawal' | 'deposit' | 'referral' | 'training';
  amount: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  address: string;
  hash?: string;
  message?: string;
}

export interface WalletBalance {
  available: number;
  pending: number;
  total: number;
}

class WalletService {
  private client: TonClient;
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.endpoint = process.env.TON_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
    this.apiKey = process.env.TON_API_KEY || '';
    this.client = new TonClient({
      endpoint: this.endpoint,
      apiKey: this.apiKey
    });
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      if (!validateTonAddress(address)) {
        throw new Error('Invalid TON address');
      }

      const response = await fetch(`${this.endpoint}/getBalance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ address })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      return {
        available: data.balance / 1e9,
        pending: data.pendingBalance / 1e9,
        total: (data.balance + data.pendingBalance) / 1e9
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  async getTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
    try {
      if (!validateTonAddress(address)) {
        throw new Error('Invalid TON address');
      }

      const response = await fetch(`${this.endpoint}/getTransactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ address, limit })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      return data.transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount / 1e9,
        timestamp: tx.timestamp,
        status: tx.status,
        address: tx.address,
        hash: tx.hash,
        message: tx.message
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async withdraw(params: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    secretKey: Uint8Array;
  }): Promise<{ hash: string }> {
    try {
      const { fromAddress, toAddress, amount, secretKey } = params;

      if (!validateTonAddress(fromAddress) || !validateTonAddress(toAddress)) {
        throw new Error('Invalid address');
      }

      const wallet = WalletContractV4.create({
        publicKey: secretKey.slice(32),
        workchain: 0
      });

      const seqno = await wallet.getSeqno();
      const transfer = wallet.createTransfer({
        secretKey,
        seqno,
        messages: [
          internal({
            to: toAddress,
            value: amount * 1e9,
            bounce: false
          })
        ]
      });

      const result = await this.client.sendTransaction(transfer);
      return { hash: result.hash };
    } catch (error) {
      console.error('Error withdrawing TON:', error);
      throw error;
    }
  }

  async createWallet(mnemonic: string[]): Promise<{ address: string; secretKey: Uint8Array }> {
    try {
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      const wallet = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0
      });

      return {
        address: wallet.address.toString(),
        secretKey: keyPair.secretKey
      };
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }

  async estimateWithdrawalFee(amount: number): Promise<number> {
    return calculateFee(amount);
  }
}

export const walletService = new WalletService(); 