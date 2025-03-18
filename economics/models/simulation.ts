import { BigNumber } from 'bignumber.js';
import { Worker, Task, TokenState, SimulationParams } from './types';

class TokenEconomySimulation {
    private workers: Map<string, Worker>;
    private tasks: Task[];
    private tokenState: TokenState;
    private params: SimulationParams;

    constructor(params: SimulationParams) {
        this.params = params;
        this.workers = new Map();
        this.tasks = [];
        this.tokenState = {
            totalMBUSupply: new BigNumber(1e9), // 1 billion
            circulatingMBU: new BigNumber(0),
            totalStaked: new BigNumber(0),
            treasuryBalance: new BigNumber(0),
            burnedTokens: new BigNumber(0)
        };
    }

    public async runSimulation(days: number) {
        console.log('Starting token economy simulation...');
        
        for (let day = 1; day <= days; day++) {
            await this.simulateDay(day);
            this.printDailyMetrics(day);
        }

        this.printFinalReport();
    }

    private async simulateDay(day: number) {
        // Generate new tasks
        const newTasks = this.generateDailyTasks(day);
        this.tasks.push(...newTasks);

        // Process worker actions
        for (const [workerId, worker] of this.workers) {
            // Stake tokens
            if (this.shouldStakeTokens(worker)) {
                const stakeAmount = this.calculateOptimalStake(worker);
                this.processStaking(worker, stakeAmount);
            }

            // Complete tasks
            const workerTasks = this.assignTasksToWorker(worker);
            for (const task of workerTasks) {
                const result = this.processVerification(worker, task);
                this.distributeRewards(worker, result);
            }

            // Update reputation
            this.updateWorkerReputation(worker);
        }

        // Process token economics
        this.processDailyTokenomics();
    }

    private generateDailyTasks(day: number): Task[] {
        const baseTaskCount = this.params.baseTasksPerDay;
        const growthFactor = 1 + (day * this.params.dailyGrowthRate);
        const taskCount = Math.floor(baseTaskCount * growthFactor);

        return Array.from({ length: taskCount }, (_, i) => ({
            id: `task-${day}-${i}`,
            complexity: Math.random(),
            reward: this.calculateTaskReward(),
            requiredReputation: Math.random() * 5000
        }));
    }

    private calculateTaskReward(): BigNumber {
        const baseReward = new BigNumber(10);
        const variability = new BigNumber(Math.random() * 40);
        return baseReward.plus(variability);
    }

    private processVerification(worker: Worker, task: Task) {
        const baseAccuracy = worker.skillLevel * (0.7 + Math.random() * 0.3);
        const reputationBonus = worker.reputation / 5000 * 0.1;
        const finalAccuracy = Math.min(baseAccuracy + reputationBonus, 1);

        return {
            accuracy: finalAccuracy,
            reward: this.calculateReward(task, finalAccuracy),
            reputationChange: this.calculateReputationChange(finalAccuracy)
        };
    }

    private calculateReward(task: Task, accuracy: number): BigNumber {
        if (accuracy < 0.75) return new BigNumber(0);

        const baseReward = task.reward;
        const accuracyMultiplier = new BigNumber(accuracy).minus(0.75).times(4);
        return baseReward.times(accuracyMultiplier);
    }

    private calculateReputationChange(accuracy: number): number {
        if (accuracy < 0.75) return -50;
        return Math.floor((accuracy - 0.75) * 200);
    }

    private processDailyTokenomics() {
        // Process token burns
        const dailyBurn = this.tokenState.circulatingMBU
            .times(this.params.dailyBurnRate);
        this.tokenState.burnedTokens = this.tokenState.burnedTokens.plus(dailyBurn);
        this.tokenState.circulatingMBU = this.tokenState.circulatingMBU.minus(dailyBurn);

        // Process staking rewards
        const stakingRewards = this.tokenState.totalStaked
            .times(this.params.dailyStakingReward);
        this.tokenState.circulatingMBU = this.tokenState.circulatingMBU.plus(stakingRewards);

        // Process treasury operations
        const treasuryGrowth = this.tokenState.treasuryBalance
            .times(this.params.treasuryGrowthRate);
        this.tokenState.treasuryBalance = this.tokenState.treasuryBalance.plus(treasuryGrowth);
    }

    private printDailyMetrics(day: number) {
        console.log(`\nDay ${day} Metrics:`);
        console.log(`Circulating MBU: ${this.tokenState.circulatingMBU.toFormat()}`);
        console.log(`Total Staked: ${this.tokenState.totalStaked.toFormat()}`);
        console.log(`Burned Tokens: ${this.tokenState.burnedTokens.toFormat()}`);
        console.log(`Treasury Balance: ${this.tokenState.treasuryBalance.toFormat()}`);
        console.log(`Active Workers: ${this.workers.size}`);
        console.log(`Completed Tasks: ${this.tasks.length}`);
    }

    private printFinalReport() {
        console.log('\nFinal Simulation Report');
        console.log('=======================');
        console.log('Token Metrics:');
        console.log(`- Initial Supply: ${new BigNumber(1e9).toFormat()}`);
        console.log(`- Final Circulating Supply: ${this.tokenState.circulatingMBU.toFormat()}`);
        console.log(`- Total Burned: ${this.tokenState.burnedTokens.toFormat()}`);
        console.log(`- Total Staked: ${this.tokenState.totalStaked.toFormat()}`);
        
        console.log('\nEconomic Metrics:');
        console.log(`- Treasury Growth: ${this.tokenState.treasuryBalance
            .div(new BigNumber(1e9))
            .times(100)
            .toFormat(2)}%`);
        console.log(`- Staking Ratio: ${this.tokenState.totalStaked
            .div(this.tokenState.circulatingMBU)
            .times(100)
            .toFormat(2)}%`);
    }
}

// Example simulation parameters
const params: SimulationParams = {
    baseTasksPerDay: 1000,
    dailyGrowthRate: 0.01,
    dailyBurnRate: 0.001,
    dailyStakingReward: 0.0005,
    treasuryGrowthRate: 0.0002,
    initialWorkers: 100,
    workerGrowthRate: 0.02
};

// Run simulation
const simulation = new TokenEconomySimulation(params);
simulation.runSimulation(365).catch(console.error); 