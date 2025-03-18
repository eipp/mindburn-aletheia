import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano
} from 'ton-core';

export type UtilityTokenConfig = {
    owner: Address;
    admin: Address;
    totalSupply: bigint;
    minStake: bigint;
    lockPeriod: number;
};

export type StakeInfo = {
    amount: bigint;
    lockEndTime: number;
};

export class UtilityToken implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromConfig(config: UtilityTokenConfig) {
        const data = beginCell()
            .storeAddress(config.owner)
            .storeAddress(config.admin)
            .storeUint(0, 1) // paused
            .storeRef(beginCell().endCell()) // balances
            .storeRef(beginCell().endCell()) // stakes
            .storeRef(beginCell().endCell()) // governance_weights
            .storeRef(beginCell().endCell()) // fee_reductions
            .storeCoins(config.totalSupply)
            .storeCoins(config.minStake)
            .storeUint(config.lockPeriod, 32)
            .endCell();

        const code = Cell.fromBoc(Buffer.from('... contract code base64 ...', 'base64'))[0];
        const init = { code, data };
        return new UtilityToken(contractAddress(0, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(provider: ContractProvider, via: Sender, params: {
        to: Address;
        amount: bigint;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32) // op: transfer
                .storeAddress(params.to)
                .storeCoins(params.amount)
                .endCell(),
        });
    }

    async sendStake(provider: ContractProvider, via: Sender, params: {
        amount: bigint;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(2, 32) // op: stake
                .storeCoins(params.amount)
                .endCell(),
        });
    }

    async sendUnstake(provider: ContractProvider, via: Sender, params: {
        amount: bigint;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(3, 32) // op: unstake
                .storeCoins(params.amount)
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

    async sendUpdateAdmin(provider: ContractProvider, via: Sender, params: {
        newAdmin: Address;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(5, 32) // op: update_admin
                .storeAddress(params.newAdmin)
                .endCell(),
        });
    }

    async sendUpdateStakeParams(provider: ContractProvider, via: Sender, params: {
        newMinStake: bigint;
        newLockPeriod: number;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(6, 32) // op: update_stake_params
                .storeCoins(params.newMinStake)
                .storeUint(params.newLockPeriod, 32)
                .endCell(),
        });
    }

    async getBalance(provider: ContractProvider, address: Address): Promise<bigint> {
        const result = await provider.get('get_balance', [
            { type: 'slice', cell: beginCell().storeAddress(address).endCell() }
        ]);
        return result.stack[0].type === 'int' ? result.stack[0].value : 0n;
    }

    async getStakeInfo(provider: ContractProvider, address: Address): Promise<StakeInfo> {
        const result = await provider.get('get_stake_info', [
            { type: 'slice', cell: beginCell().storeAddress(address).endCell() }
        ]);
        const [amount, lockEndTime] = result.stack;
        
        return {
            amount: amount.type === 'int' ? amount.value : 0n,
            lockEndTime: lockEndTime.type === 'int' ? Number(lockEndTime.value) : 0
        };
    }

    async getFeeReduction(provider: ContractProvider, address: Address): Promise<number> {
        const result = await provider.get('get_fee_reduction', [
            { type: 'slice', cell: beginCell().storeAddress(address).endCell() }
        ]);
        return result.stack[0].type === 'int' ? Number(result.stack[0].value) : 0;
    }

    async getGovernanceWeight(provider: ContractProvider, address: Address): Promise<number> {
        const result = await provider.get('get_governance_weight', [
            { type: 'slice', cell: beginCell().storeAddress(address).endCell() }
        ]);
        return result.stack[0].type === 'int' ? Number(result.stack[0].value) : 0;
    }

    async getTotalSupply(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_total_supply', []);
        return result.stack[0].type === 'int' ? result.stack[0].value : 0n;
    }

    async getMinStake(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_min_stake', []);
        return result.stack[0].type === 'int' ? result.stack[0].value : 0n;
    }

    async getLockPeriod(provider: ContractProvider): Promise<number> {
        const result = await provider.get('get_lock_period', []);
        return result.stack[0].type === 'int' ? Number(result.stack[0].value) : 0;
    }

    async getOwner(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_owner', []);
        return result.stack[0].cell.beginParse().loadAddress();
    }

    async getAdmin(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_admin', []);
        return result.stack[0].cell.beginParse().loadAddress();
    }

    async isPaused(provider: ContractProvider): Promise<boolean> {
        const result = await provider.get('is_paused', []);
        return result.stack[0].type === 'int' ? result.stack[0].value === 1n : false;
    }
} 