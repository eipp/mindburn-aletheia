import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from '@ton/core';
import { TupleBuilder, TupleReader } from '@ton/core';
import { toNano } from '@ton/core';

export type TokenConfig = {
  totalSupply: bigint;
  owner: Address;
  content?: Cell;
  mintable?: boolean;
};

export class MindBurnToken implements Contract {
  static readonly DECIMALS = 9;
  static readonly MIN_STORAGE_FEE = toNano('0.01');

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: TokenConfig, code: Cell, workchain = 0) {
    const data = beginCell()
      .storeUint(config.totalSupply, 32)
      .storeAddress(config.owner)
      .storeRef(config.content || beginCell().endCell())
      .storeBit(config.mintable || false)
      .endCell();

    const init = { code, data };
    const address = contractAddress(workchain, init);
    return new MindBurnToken(address, init);
  }

  async getBalance(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('get_total_supply', []);
    return result.stack.readBigNumber();
  }

  async getOwner(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('get_owner', []);
    return result.stack.readAddress();
  }

  async mint(provider: ContractProvider, params: { to: Address; amount: bigint }) {
    const owner = await this.getOwner(provider);
    if (!owner.equals(provider.sender!)) {
      throw new Error('Only owner can mint tokens');
    }

    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(1, 32) // op: mint
        .storeAddress(params.to)
        .storeUint(params.amount, 32)
        .endCell(),
    });
  }

  async transfer(
    provider: ContractProvider,
    params: { to: Address; amount: bigint; payload?: Cell }
  ) {
    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(2, 32) // op: transfer
        .storeAddress(params.to)
        .storeUint(params.amount, 32)
        .storeRef(params.payload || beginCell().endCell())
        .endCell(),
    });
  }

  async burn(provider: ContractProvider, params: { amount: bigint }) {
    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(3, 32) // op: burn
        .storeUint(params.amount, 32)
        .endCell(),
    });
  }

  async approve(provider: ContractProvider, params: { spender: Address; amount: bigint }) {
    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(4, 32) // op: approve
        .storeAddress(params.spender)
        .storeUint(params.amount, 32)
        .endCell(),
    });
  }

  async transferFrom(
    provider: ContractProvider,
    params: { from: Address; to: Address; amount: bigint }
  ) {
    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(5, 32) // op: transferFrom
        .storeAddress(params.from)
        .storeAddress(params.to)
        .storeUint(params.amount, 32)
        .endCell(),
    });
  }

  async getAllowance(
    provider: ContractProvider,
    params: { owner: Address; spender: Address }
  ): Promise<bigint> {
    const result = await provider.get('get_allowance', [
      { type: 'slice', cell: beginCell().storeAddress(params.owner).endCell() },
      { type: 'slice', cell: beginCell().storeAddress(params.spender).endCell() },
    ]);
    return result.stack.readBigNumber();
  }
}
