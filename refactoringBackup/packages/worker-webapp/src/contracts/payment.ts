import {
  Contract,
  ContractProvider,
  Address,
  Cell,
  beginCell,
  toNano,
} from '@ton/core';
import { TonClient } from '@ton/ton';

export class PaymentContract implements Contract {
  constructor(
    readonly address: Address,
    readonly client: TonClient
  ) {}

  static createForDeploy(code: Cell, owner: Address): PaymentContract {
    const data = beginCell()
      .storeAddress(owner)
      .storeUint(0, 64) // total_payments
      .storeDict() // payments
      .endCell();
    
    const workchain = 0;
    const address = contractAddress(workchain, { code, data });
    
    return new PaymentContract(address, client);
  }

  async sendReward(
    workerAddress: Address,
    amount: string,
    taskId: string,
    signature: string
  ) {
    const provider = this.client.provider();
    
    const messageBody = beginCell()
      .storeUint(1, 32) // op: send_reward
      .storeAddress(workerAddress)
      .storeCoins(toNano(amount))
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(taskId))
          .storeBuffer(Buffer.from(signature))
          .endCell()
      )
      .endCell();

    const tx = await provider.internal(this.address, {
      value: toNano(amount),
      body: messageBody,
    });

    return tx;
  }

  async getPaymentInfo(taskId: string) {
    const provider = this.client.provider();
    
    const { stack } = await provider.get('get_payment_info', [
      { type: 'slice', cell: beginCell().storeBuffer(Buffer.from(taskId)).endCell() },
    ]);

    if (!stack.length) {
      return null;
    }

    return {
      amount: stack[0].toString(),
      recipient: stack[1].toString(),
      timestamp: stack[2].toNumber(),
      status: stack[3].toNumber(),
    };
  }

  async getStats() {
    const provider = this.client.provider();
    
    const { stack } = await provider.get('get_stats', []);

    return {
      totalPayments: stack[0].toNumber(),
      totalAmount: stack[1].toString(),
      activeWorkers: stack[2].toNumber(),
    };
  }
}

// Contract op codes
export const PaymentOps = {
  SendReward: 1,
  WithdrawFunds: 2,
  UpdateConfig: 3,
};

// Contract errors
export const PaymentErrors = {
  InsufficientFunds: 101,
  InvalidSignature: 102,
  InvalidAmount: 103,
  UnauthorizedAccess: 104,
}; 