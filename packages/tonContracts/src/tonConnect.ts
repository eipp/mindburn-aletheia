import { TonConnect } from '@tonconnect/sdk';
import { Address, beginCell, toNano } from '@ton/core';
import { CHAIN } from '@tonconnect/protocol';

export class TonWalletConnector {
  private connector: TonConnect;
  private contractAddress: Address;

  constructor(manifestUrl: string, contractAddress: string) {
    this.connector = new TonConnect({ manifestUrl });
    this.contractAddress = Address.parse(contractAddress);
  }

  async connect() {
    const wallets = await this.connector.getWallets();
    if (wallets.length === 0) {
      throw new Error('No TON wallets found');
    }

    const universalLink = this.connector.connect({
      universalUrl: wallets[0].universalUrl,
      bridgeUrl: wallets[0].bridgeUrl,
    });

    return universalLink;
  }

  async createTask(taskId: string, reward: string) {
    if (!this.connector.connected) {
      throw new Error('Wallet not connected');
    }

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      network: CHAIN.MAINNET,
      from: this.connector.account!.address,
      messages: [
        {
          address: this.contractAddress.toString(),
          amount: toNano(reward).toString(),
          stateInit: null,
          payload: beginCell()
            .storeUint(0x1234567, 32) // op::create_task
            .storeUint(BigInt(taskId), 256)
            .endCell()
            .toBoc()
            .toString('base64'),
        },
      ],
    };

    try {
      const result = await this.connector.sendTransaction(transaction);
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async verifyTask(taskId: string, success: boolean) {
    if (!this.connector.connected) {
      throw new Error('Wallet not connected');
    }

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300,
      network: CHAIN.MAINNET,
      from: this.connector.account!.address,
      messages: [
        {
          address: this.contractAddress.toString(),
          amount: toNano('0.05').toString(), // Gas fees
          stateInit: null,
          payload: beginCell()
            .storeUint(0x1234569, 32) // op::verify_task
            .storeUint(BigInt(taskId), 256)
            .storeBit(success)
            .endCell()
            .toBoc()
            .toString('base64'),
        },
      ],
    };

    try {
      const result = await this.connector.sendTransaction(transaction);
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async disconnect() {
    await this.connector.disconnect();
  }

  onStatusChange(callback: (walletInfo: any) => void) {
    this.connector.onStatusChange(callback);
  }

  isConnected(): boolean {
    return this.connector.connected;
  }

  getAddress(): string | null {
    return this.connector.account?.address || null;
  }
}
