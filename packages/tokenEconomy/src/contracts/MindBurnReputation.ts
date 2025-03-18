import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  SendMode,
} from '@ton/core';
import { toNano } from '@ton/core';

export type ReputationConfig = {
  admin: Address;
  decayRate: number; // Monthly decay rate in basis points (e.g., 500 = 5%)
  minVerificationScore: number; // Minimum score to earn reputation (e.g., 75)
};

export class MindBurnReputation implements Contract {
  static readonly MAX_REPUTATION = 5000;
  static readonly LEVEL_THRESHOLDS = [0, 100, 500, 2000, 5000];

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: ReputationConfig, code: Cell, workchain = 0) {
    const data = beginCell()
      .storeAddress(config.admin)
      .storeUint(config.decayRate, 16)
      .storeUint(config.minVerificationScore, 8)
      .endCell();

    const init = { code, data };
    const address = contractAddress(workchain, init);
    return new MindBurnReputation(address, init);
  }

  async getWorkerReputation(provider: ContractProvider, worker: Address): Promise<number> {
    const result = await provider.get('get_worker_reputation', [
      { type: 'slice', cell: beginCell().storeAddress(worker).endCell() },
    ]);
    return result.stack.readNumber();
  }

  async getWorkerLevel(provider: ContractProvider, worker: Address): Promise<number> {
    const reputation = await this.getWorkerReputation(provider, worker);
    return this.calculateLevel(reputation);
  }

  private calculateLevel(reputation: number): number {
    for (let i = MindBurnReputation.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (reputation >= MindBurnReputation.LEVEL_THRESHOLDS[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  async updateReputation(
    provider: ContractProvider,
    params: { worker: Address; verificationScore: number }
  ) {
    const admin = await this.getAdmin(provider);
    if (!admin.equals(provider.sender!)) {
      throw new Error('Only admin can update reputation');
    }

    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(1, 32) // op: updateReputation
        .storeAddress(params.worker)
        .storeUint(params.verificationScore, 8)
        .endCell(),
    });
  }

  async applyDecay(provider: ContractProvider) {
    const admin = await this.getAdmin(provider);
    if (!admin.equals(provider.sender!)) {
      throw new Error('Only admin can apply decay');
    }

    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(2, 32) // op: applyDecay
        .endCell(),
    });
  }

  async getAdmin(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('get_admin', []);
    return result.stack.readAddress();
  }

  async getDecayRate(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_decay_rate', []);
    return result.stack.readNumber();
  }

  async getMinVerificationScore(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_min_verification_score', []);
    return result.stack.readNumber();
  }

  async getVerificationHistory(provider: ContractProvider, worker: Address): Promise<Cell> {
    const result = await provider.get('get_verification_history', [
      { type: 'slice', cell: beginCell().storeAddress(worker).endCell() },
    ]);
    return result.stack.readCell();
  }

  async getReputationMultiplier(provider: ContractProvider, worker: Address): Promise<number> {
    const level = await this.getWorkerLevel(provider, worker);
    return level; // Multiplier is equal to level (1x-5x)
  }
}
