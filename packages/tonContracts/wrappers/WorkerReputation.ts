import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from 'ton-core';

export type WorkerReputationConfig = {
  owner: Address;
  admin: Address;
  minScore: number;
  levelThreshold: number;
};

export type WorkerData = {
  level: number;
  score: number;
  totalTasks: number;
};

export class WorkerReputation implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: WorkerReputationConfig) {
    const data = beginCell()
      .storeAddress(config.owner)
      .storeAddress(config.admin)
      .storeUint(0, 1) // paused
      .storeRef(beginCell().endCell()) // workers
      .storeRef(beginCell().endCell()) // history
      .storeUint(config.minScore, 16)
      .storeUint(config.levelThreshold, 16)
      .endCell();

    const code = Cell.fromBoc(Buffer.from('... contract code base64 ...', 'base64'))[0];
    const init = { code, data };
    return new WorkerReputation(contractAddress(0, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendRegisterWorker(
    provider: ContractProvider,
    via: Sender,
    params: {
      worker: Address;
    }
  ) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(1, 32) // op: register_worker
        .storeAddress(params.worker)
        .endCell(),
    });
  }

  async sendUpdateReputation(
    provider: ContractProvider,
    via: Sender,
    params: {
      worker: Address;
      qualityScore: number;
      taskComplexity: number;
    }
  ) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(2, 32) // op: update_reputation
        .storeAddress(params.worker)
        .storeUint(params.qualityScore, 8)
        .storeUint(params.taskComplexity, 8)
        .endCell(),
    });
  }

  async sendApplyPenalty(
    provider: ContractProvider,
    via: Sender,
    params: {
      worker: Address;
      penaltyReason: number;
    }
  ) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(3, 32) // op: apply_penalty
        .storeAddress(params.worker)
        .storeUint(params.penaltyReason, 8)
        .endCell(),
    });
  }

  async sendTogglePause(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(4, 32) // op: toggle_pause
        .endCell(),
    });
  }

  async sendUpdateAdmin(
    provider: ContractProvider,
    via: Sender,
    params: {
      newAdmin: Address;
    }
  ) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(5, 32) // op: update_admin
        .storeAddress(params.newAdmin)
        .endCell(),
    });
  }

  async sendUpdateThresholds(
    provider: ContractProvider,
    via: Sender,
    params: {
      newMinScore: number;
      newLevelThreshold: number;
    }
  ) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(6, 32) // op: update_thresholds
        .storeUint(params.newMinScore, 16)
        .storeUint(params.newLevelThreshold, 16)
        .endCell(),
    });
  }

  async getWorkerData(provider: ContractProvider, worker: Address): Promise<WorkerData> {
    const result = await provider.get('get_worker_data', [
      { type: 'slice', cell: beginCell().storeAddress(worker).endCell() },
    ]);
    const [level, score, totalTasks] = result.stack;

    return {
      level: level.type === 'int' ? Number(level.value) : 0,
      score: score.type === 'int' ? Number(score.value) : 0,
      totalTasks: totalTasks.type === 'int' ? Number(totalTasks.value) : 0,
    };
  }

  async getWorkerHistory(provider: ContractProvider, worker: Address): Promise<Cell> {
    const result = await provider.get('get_worker_history', [
      { type: 'slice', cell: beginCell().storeAddress(worker).endCell() },
    ]);
    return result.stack[0].cell;
  }

  async getOwner(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('get_owner', []);
    return result.stack[0].cell.beginParse().loadAddress();
  }

  async getAdmin(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('get_admin', []);
    return result.stack[0].cell.beginParse().loadAddress();
  }

  async getMinScore(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_min_score', []);
    return result.stack[0].type === 'int' ? Number(result.stack[0].value) : 0;
  }

  async getLevelThreshold(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_level_threshold', []);
    return result.stack[0].type === 'int' ? Number(result.stack[0].value) : 0;
  }

  async isPaused(provider: ContractProvider): Promise<boolean> {
    const result = await provider.get('is_paused', []);
    return result.stack[0].type === 'int' ? result.stack[0].value === 1n : false;
  }
}
