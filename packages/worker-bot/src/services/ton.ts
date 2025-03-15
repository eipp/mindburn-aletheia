import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Transaction, TransactionStatus, TransactionType } from '../types';

export class TonService {
  private client: TonClient;
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.endpoint = process.env.TON_ENDPOINT!;
    this.apiKey = process.env.TON_API_KEY!;
    this.client = new TonClient({
      endpoint: this.endpoint,
      apiKey: this.apiKey
    });
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      return await this.client.getBalance(address);
    } catch (error) {
      console.error('Error getting balance:', error);
      return BigInt(0);
    }
  }

  async validateAddress(address: string): Promise<boolean> {
    try {
      return this.client.isContractDeployed(address);
    } catch {
      return false;
    }
  }

  async createWallet(mnemonic: string[]): Promise<{ address: string; key: Buffer }> {
    try {
      const key = await mnemonicToPrivateKey(mnemonic);
      const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
      const address = wallet.address.toString();

      return { address, key: key.secretKey };
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }

  async sendTransaction(
    fromAddress: string,
    toAddress: string,
    amount: bigint,
    secretKey: Buffer
  ): Promise<{ hash: string; status: TransactionStatus }> {
    try {
      const wallet = WalletContractV4.create({
        publicKey: secretKey.slice(32),
        workchain: 0
      });

      const seqno = await wallet.getSeqno();
      const transfer = await wallet.createTransfer({
        secretKey,
        seqno,
        messages: [
          internal({
            to: toAddress,
            value: amount,
            bounce: false
          })
        ]
      });

      await this.client.sendTransaction(transfer);

      return {
        hash: transfer.hash().toString('hex'),
        status: TransactionStatus.COMPLETED
      };
    } catch (error) {
      console.error('Error sending transaction:', error);
      return {
        hash: '',
        status: TransactionStatus.FAILED
      };
    }
  }

  async processReward(
    workerAddress: string,
    amount: bigint,
    taskId: string
  ): Promise<Transaction> {
    const transaction: Transaction = {
      id: `${Date.now()}-${taskId}`,
      userId: workerAddress,
      type: TransactionType.REWARD,
      amount: Number(amount),
      status: TransactionStatus.PENDING,
      taskId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      // Here you would implement the actual reward distribution logic
      // This could involve a smart contract call or other mechanism
      
      transaction.status = TransactionStatus.COMPLETED;
    } catch (error) {
      console.error('Error processing reward:', error);
      transaction.status = TransactionStatus.FAILED;
    }

    return transaction;
  }

  getExplorerUrl(hash: string): string {
    const network = process.env.TON_NETWORK === 'mainnet' ? '' : 'testnet.';
    return `https://${network}tonscan.org/tx/${hash}`;
  }
} 