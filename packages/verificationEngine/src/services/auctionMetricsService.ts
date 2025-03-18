import { Logger } from '@mindburn/shared/logger';
import {
  AuctionBid,
  AuctionResult,
  TaskType,
  WorkerLevel,
  TaskPriority
} from '../types';

interface AuctionMetrics {
  averageBid: number;
  medianBid: number;
  bidSpread: number;
  participationRate: number;
  completionRate: number;
  averageDuration: number;
  workerLevelDistribution: Record<WorkerLevel, number>;
}

interface BidHistory {
  taskType: TaskType;
  workerLevel: WorkerLevel;
  priority: TaskPriority;
  bids: Array<{
    amount: number;
    timestamp: number;
  }>;
  metrics: {
    average: number;
    median: number;
    min: number;
    max: number;
  };
}

export class AuctionMetricsService {
  private readonly logger: Logger;
  private readonly metrics: Map<string, AuctionMetrics> = new Map();
  private readonly bidHistory: Map<TaskType, BidHistory[]> = new Map();
  
  // Moving window for metrics calculation (7 days)
  private readonly metricsWindow = 7 * 24 * 60 * 60 * 1000;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'AuctionMetrics' });
  }

  async trackAuctionResult(result: AuctionResult): Promise<void> {
    try {
      await this.updateMetrics(result);
      await this.updateBidHistory(result);
      
      this.logger.info('Updated auction metrics', {
        auctionId: result.auctionId,
        taskId: result.taskId
      });
    } catch (error) {
      this.logger.error('Failed to track auction result', {
        error,
        auctionId: result.auctionId
      });
    }
  }

  async getMetricsForTaskType(
    taskType: TaskType,
    workerLevel: WorkerLevel,
    priority: TaskPriority
  ): Promise<AuctionMetrics | null> {
    const key = this.getMetricsKey(taskType, workerLevel, priority);
    return this.metrics.get(key) || null;
  }

  async getBidHistory(
    taskType: TaskType,
    workerLevel: WorkerLevel,
    priority: TaskPriority,
    timeRange?: { start: number; end: number }
  ): Promise<BidHistory | null> {
    const history = this.bidHistory.get(taskType);
    if (!history) return null;

    const filtered = history.filter(h => 
      h.workerLevel === workerLevel && 
      h.priority === priority &&
      (!timeRange || (
        h.bids.some(bid => 
          bid.timestamp >= timeRange.start && 
          bid.timestamp <= timeRange.end
        )
      ))
    );

    if (filtered.length === 0) return null;

    // Combine all matching histories
    return {
      taskType,
      workerLevel,
      priority,
      bids: filtered.flatMap(h => h.bids),
      metrics: this.calculateBidMetrics(filtered.flatMap(h => h.bids.map(b => b.amount)))
    };
  }

  async getRecommendedBidRange(
    taskType: TaskType,
    workerLevel: WorkerLevel,
    priority: TaskPriority
  ): Promise<{ min: number; max: number } | null> {
    const history = await this.getBidHistory(
      taskType,
      workerLevel,
      priority,
      {
        start: Date.now() - this.metricsWindow,
        end: Date.now()
      }
    );

    if (!history || history.bids.length === 0) {
      return null;
    }

    return {
      min: Math.max(1, Math.floor(history.metrics.average * 0.8)),
      max: Math.ceil(history.metrics.average * 1.2)
    };
  }

  private async updateMetrics(result: AuctionResult): Promise<void> {
    const { taskType, workerLevel, priority } = result.metadata;
    const key = this.getMetricsKey(taskType, workerLevel, priority);

    const metrics: AuctionMetrics = {
      averageBid: this.calculateAverageBid(result),
      medianBid: this.calculateMedianBid(result),
      bidSpread: this.calculateBidSpread(result),
      participationRate: this.calculateParticipationRate(result),
      completionRate: this.calculateCompletionRate(result),
      averageDuration: result.endTime - result.startTime,
      workerLevelDistribution: this.calculateWorkerLevelDistribution(result)
    };

    this.metrics.set(key, metrics);
  }

  private async updateBidHistory(result: AuctionResult): Promise<void> {
    const { taskType, workerLevel, priority } = result.metadata;
    
    const bids = result.winners.map(winner => ({
      amount: winner.winningBid,
      timestamp: result.endTime
    }));

    const history: BidHistory = {
      taskType,
      workerLevel,
      priority,
      bids,
      metrics: this.calculateBidMetrics(bids.map(b => b.amount))
    };

    const existingHistory = this.bidHistory.get(taskType) || [];
    existingHistory.push(history);

    // Remove old history entries
    const cutoffTime = Date.now() - this.metricsWindow;
    const filteredHistory = existingHistory.filter(h =>
      h.bids.some(bid => bid.timestamp >= cutoffTime)
    );

    this.bidHistory.set(taskType, filteredHistory);
  }

  private getMetricsKey(
    taskType: TaskType,
    workerLevel: WorkerLevel,
    priority: TaskPriority
  ): string {
    return `${taskType}:${workerLevel}:${priority}`;
  }

  private calculateBidMetrics(bids: number[]): {
    average: number;
    median: number;
    min: number;
    max: number;
  } {
    if (bids.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    const sorted = [...bids].sort((a, b) => a - b);
    return {
      average: bids.reduce((a, b) => a + b, 0) / bids.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  private calculateAverageBid(result: AuctionResult): number {
    const bids = result.winners.map(w => w.winningBid);
    return bids.reduce((a, b) => a + b, 0) / bids.length;
  }

  private calculateMedianBid(result: AuctionResult): number {
    const bids = result.winners.map(w => w.winningBid).sort((a, b) => a - b);
    return bids[Math.floor(bids.length / 2)];
  }

  private calculateBidSpread(result: AuctionResult): number {
    const bids = result.winners.map(w => w.winningBid);
    const max = Math.max(...bids);
    const min = Math.min(...bids);
    return max - min;
  }

  private calculateParticipationRate(result: AuctionResult): number {
    return result.totalBids / (result.metadata.eligibleWorkers || 1);
  }

  private calculateCompletionRate(result: AuctionResult): number {
    return result.winners.length / (result.metadata.requiredWinners || 1);
  }

  private calculateWorkerLevelDistribution(
    result: AuctionResult
  ): Record<WorkerLevel, number> {
    const distribution: Record<WorkerLevel, number> = {
      [WorkerLevel.BEGINNER]: 0,
      [WorkerLevel.INTERMEDIATE]: 0,
      [WorkerLevel.ADVANCED]: 0,
      [WorkerLevel.EXPERT]: 0
    };

    result.winners.forEach(winner => {
      const level = winner.metadata?.workerLevel;
      if (level && level in distribution) {
        distribution[level]++;
      }
    });

    return distribution;
  }
} 