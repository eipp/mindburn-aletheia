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
} from '@ton/core';

export type MindBurnConfig = {
    owner: Address;
    minStake: bigint;
};

export type TaskData = {
    client: Address;
    reward: bigint;
    status: bigint;
    worker?: Address;
    success?: boolean;
};

export type WorkerData = {
    reputation: bigint;
    completedTasks: bigint;
};

export class MindBurnPayments implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromConfig(config: MindBurnConfig, code: Cell) {
        const data = beginCell()
            .storeAddress(config.owner)
            .storeDict(null) // clients
            .storeDict(null) // workers
            .storeDict(null) // tasks
            .storeCoins(config.minStake)
            .endCell();

        const init = { code, data };
        return new MindBurnPayments(contractAddress(0, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateTask(provider: ContractProvider, via: Sender, opts: {
        taskId: bigint;
        value: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value + toNano('0.05'), // Add gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1234567, 32) // op::create_task
                .storeUint(opts.taskId, 256)
                .endCell(),
        });
    }

    async sendAssignTask(provider: ContractProvider, via: Sender, opts: {
        taskId: bigint;
        worker: Address;
    }) {
        await provider.internal(via, {
            value: toNano('0.05'), // Gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1234568, 32) // op::assign_task
                .storeUint(opts.taskId, 256)
                .storeAddress(opts.worker)
                .endCell(),
        });
    }

    async sendVerifyTask(provider: ContractProvider, via: Sender, opts: {
        taskId: bigint;
        success: boolean;
    }) {
        await provider.internal(via, {
            value: toNano('0.05'), // Gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1234569, 32) // op::verify_task
                .storeUint(opts.taskId, 256)
                .storeBit(opts.success)
                .endCell(),
        });
    }

    async sendApprovePayment(provider: ContractProvider, via: Sender, opts: {
        taskId: bigint;
    }) {
        await provider.internal(via, {
            value: toNano('0.05'), // Gas
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x123456c, 32) // op::approve_payment
                .storeUint(opts.taskId, 256)
                .endCell(),
        });
    }

    async getTask(provider: ContractProvider, taskId: bigint): Promise<TaskData | null> {
        const result = await provider.get('get_task', [
            { type: 'int', value: taskId },
        ]);
        
        if (result.stack.readBoolean() === false) {
            return null;
        }

        const data = result.stack.readCell();
        const slice = data.beginParse();
        
        const task: TaskData = {
            client: slice.loadAddress(),
            reward: slice.loadCoins(),
            status: slice.loadUint(2),
        };

        if (task.status >= 1n) {
            task.worker = slice.loadAddress();
        }

        if (task.status === 2n) {
            task.success = slice.loadBit();
        }

        return task;
    }

    async getWorker(provider: ContractProvider, address: Address): Promise<WorkerData | null> {
        const result = await provider.get('get_worker', [
            { type: 'slice', cell: beginCell().storeAddress(address).endCell() },
        ]);
        
        if (result.stack.readBoolean() === false) {
            return null;
        }

        const data = result.stack.readCell();
        const slice = data.beginParse();
        
        return {
            reputation: slice.loadUint(32),
            completedTasks: slice.loadUint(32),
        };
    }
} 