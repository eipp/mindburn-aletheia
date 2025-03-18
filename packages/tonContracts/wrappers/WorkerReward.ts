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

export type WorkerRewardConfig = {
    owner: Address;
    admin: Address;
    minStake: bigint;
    largePaymentThreshold: bigint;
};

export type TaskData = {
    amount: bigint;
    worker?: Address;
    status: 'pending' | 'in_progress' | 'completed' | 'disputed' | 'pending_approval';
};

export class WorkerReward implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromConfig(config: WorkerRewardConfig) {
        const data = beginCell()
            .storeAddress(config.owner)
            .storeAddress(config.admin)
            .storeUint(0, 1) // paused
            .storeRef(beginCell().endCell()) // tasks
            .storeRef(beginCell().endCell()) // workers
            .storeCoins(config.minStake)
            .storeCoins(config.largePaymentThreshold)
            .endCell();

        const code = Cell.fromBoc(Buffer.from('... contract code base64 ...', 'base64'))[0];
        const init = { code, data };
        return new WorkerReward(contractAddress(0, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateTask(provider: ContractProvider, via: Sender, params: {
        value: bigint;
        taskId: number;
        complexity: number;
        deadline: number;
    }) {
        await provider.internal(via, {
            value: params.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32) // op: create_task
                .storeUint(params.taskId, 32)
                .storeUint(params.complexity, 8)
                .storeUint(params.deadline, 64)
                .endCell(),
        });
    }

    async sendAssignTask(provider: ContractProvider, via: Sender, params: {
        taskId: number;
        worker: Address;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(2, 32) // op: assign_task
                .storeUint(params.taskId, 32)
                .storeAddress(params.worker)
                .endCell(),
        });
    }

    async sendSubmitVerification(provider: ContractProvider, via: Sender, params: {
        taskId: number;
        qualityScore: number;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(3, 32) // op: submit_verification
                .storeUint(params.taskId, 32)
                .storeUint(params.qualityScore, 8)
                .endCell(),
        });
    }

    async sendApprovePayment(provider: ContractProvider, via: Sender, params: {
        taskId: number;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(4, 32) // op: approve_payment
                .storeUint(params.taskId, 32)
                .endCell(),
        });
    }

    async sendTogglePause(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(5, 32) // op: toggle_pause
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
                .storeUint(6, 32) // op: update_admin
                .storeAddress(params.newAdmin)
                .endCell(),
        });
    }

    async sendUpdateThresholds(provider: ContractProvider, via: Sender, params: {
        newMinStake: bigint;
        newLargePaymentThreshold: bigint;
    }) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(7, 32) // op: update_thresholds
                .storeCoins(params.newMinStake)
                .storeCoins(params.newLargePaymentThreshold)
                .endCell(),
        });
    }

    async sendEmergencyWithdraw(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(8, 32) // op: emergency_withdraw
                .endCell(),
        });
    }

    async getTask(provider: ContractProvider, taskId: number): Promise<TaskData> {
        const result = await provider.get('get_task', [
            { type: 'int', value: BigInt(taskId) }
        ]);
        const [amount, workerSlice, status] = result.stack;
        
        return {
            amount: amount.type === 'int' ? amount.value : 0n,
            worker: workerSlice.type === 'slice' ? workerSlice.cell.beginParse().loadAddress() : undefined,
            status: this.parseTaskStatus(status.type === 'int' ? Number(status.value) : 0)
        };
    }

    async getOwner(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_owner', []);
        return result.stack[0].cell.beginParse().loadAddress();
    }

    async getAdmin(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_admin', []);
        return result.stack[0].cell.beginParse().loadAddress();
    }

    async getMinStake(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_min_stake', []);
        return result.stack[0].type === 'int' ? result.stack[0].value : 0n;
    }

    async getLargePaymentThreshold(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_large_payment_threshold', []);
        return result.stack[0].type === 'int' ? result.stack[0].value : 0n;
    }

    async isPaused(provider: ContractProvider): Promise<boolean> {
        const result = await provider.get('is_paused', []);
        return result.stack[0].type === 'int' ? result.stack[0].value === 1n : false;
    }

    private parseTaskStatus(status: number): TaskData['status'] {
        switch (status) {
            case 0: return 'pending';
            case 1: return 'in_progress';
            case 2: return 'completed';
            case 3: return 'disputed';
            case 4: return 'pending_approval';
            default: return 'pending';
        }
    }
} 