import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, SendMode } from '@ton/core';
import { toNano } from '@ton/core';

export type ProposalType = 'PARAMETER_CHANGE' | 'TREASURY_SPEND' | 'PROTOCOL_UPGRADE';

export type ProposalConfig = {
  id: number;
  proposer: Address;
  description: string;
  type: ProposalType;
  parameters: Cell;
  startTime: number;
  endTime: number;
};

export type GovernanceConfig = {
  admin: Address;
  proposalThreshold: bigint; // Minimum tokens required to create proposal
  votingPeriod: number; // Voting period in seconds
  executionDelay: number; // Delay before execution in seconds
  quorumThreshold: number; // Required quorum in basis points (e.g., 4000 = 40%)
};

export class MindBurnGovernance implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: GovernanceConfig, code: Cell, workchain = 0) {
    const data = beginCell()
      .storeAddress(config.admin)
      .storeUint(config.proposalThreshold, 32)
      .storeUint(config.votingPeriod, 32)
      .storeUint(config.executionDelay, 32)
      .storeUint(config.quorumThreshold, 16)
      .endCell();

    const init = { code, data };
    const address = contractAddress(workchain, init);
    return new MindBurnGovernance(address, init);
  }

  async createProposal(
    provider: ContractProvider,
    params: {
      description: string;
      type: ProposalType;
      parameters: Cell;
    }
  ) {
    const proposerBalance = await this.getVotingPower(
      provider,
      provider.sender!
    );
    const threshold = await this.getProposalThreshold(provider);

    if (proposerBalance < threshold) {
      throw new Error('Insufficient voting power to create proposal');
    }

    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.1'),
      body: beginCell()
        .storeUint(1, 32) // op: createProposal
        .storeStringTail(params.description)
        .storeStringTail(params.type)
        .storeRef(params.parameters)
        .endCell(),
    });
  }

  async castVote(
    provider: ContractProvider,
    params: { proposalId: number; support: boolean }
  ) {
    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.05'),
      body: beginCell()
        .storeUint(2, 32) // op: castVote
        .storeUint(params.proposalId, 32)
        .storeBit(params.support)
        .endCell(),
    });
  }

  async executeProposal(
    provider: ContractProvider,
    params: { proposalId: number }
  ) {
    const proposal = await this.getProposal(provider, params.proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const state = await this.getProposalState(provider, params.proposalId);
    if (state !== 'Succeeded') {
      throw new Error('Proposal not in executable state');
    }

    await provider.internal(SendMode.PAY_GAS_SEPARATELY, {
      value: toNano('0.1'),
      body: beginCell()
        .storeUint(3, 32) // op: executeProposal
        .storeUint(params.proposalId, 32)
        .endCell(),
    });
  }

  async getProposal(
    provider: ContractProvider,
    proposalId: number
  ): Promise<ProposalConfig | null> {
    const result = await provider.get('get_proposal', [
      { type: 'number', value: proposalId },
    ]);
    if (result.stack.readBoolean()) {
      return null;
    }
    return {
      id: proposalId,
      proposer: result.stack.readAddress(),
      description: result.stack.readString(),
      type: result.stack.readString() as ProposalType,
      parameters: result.stack.readCell(),
      startTime: result.stack.readNumber(),
      endTime: result.stack.readNumber(),
    };
  }

  async getProposalState(
    provider: ContractProvider,
    proposalId: number
  ): Promise<'Pending' | 'Active' | 'Succeeded' | 'Defeated' | 'Executed'> {
    const result = await provider.get('get_proposal_state', [
      { type: 'number', value: proposalId },
    ]);
    const state = result.stack.readNumber();
    switch (state) {
      case 0:
        return 'Pending';
      case 1:
        return 'Active';
      case 2:
        return 'Succeeded';
      case 3:
        return 'Defeated';
      case 4:
        return 'Executed';
      default:
        throw new Error('Invalid proposal state');
    }
  }

  async getVotingPower(
    provider: ContractProvider,
    voter: Address
  ): Promise<bigint> {
    const result = await provider.get('get_voting_power', [
      { type: 'slice', cell: beginCell().storeAddress(voter).endCell() },
    ]);
    return result.stack.readBigNumber();
  }

  async getProposalVotes(
    provider: ContractProvider,
    proposalId: number
  ): Promise<{ for: bigint; against: bigint }> {
    const result = await provider.get('get_proposal_votes', [
      { type: 'number', value: proposalId },
    ]);
    return {
      for: result.stack.readBigNumber(),
      against: result.stack.readBigNumber(),
    };
  }

  async getProposalThreshold(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('get_proposal_threshold', []);
    return result.stack.readBigNumber();
  }

  async getQuorumThreshold(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_quorum_threshold', []);
    return result.stack.readNumber();
  }

  async getVotingPeriod(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_voting_period', []);
    return result.stack.readNumber();
  }

  async getExecutionDelay(provider: ContractProvider): Promise<number> {
    const result = await provider.get('get_execution_delay', []);
    return result.stack.readNumber();
  }
} 