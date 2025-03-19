import { Logger } from '@mindburn/shared/logger';
import {
  VerificationTask,
  WorkerProfile,
  TaskAssignment,
  TaskPriority,
  WorkerStatus,
  AuctionResult,
  FraudDetectionResult,
} from '../types';
import { AuctionError, ValidationError } from '../errors';
import { AuctionMetricsService } from './auctionMetricsService';
import { AuctionFraudDetectionService } from './auctionFraudDetectionService';

interface Bid {
  workerId: string;
  amount: number;
  timestamp: number;
}

interface Auction {
  auctionId: string;
  taskId: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  startTime: number;
  endTime: number;
  minBid: number;
  maxBid: number;
  bids: Bid[];
  winners?: string[];
  metadata?: Record<string, any>;
}

export class AuctionService {
  private readonly logger: Logger;
  private readonly auctions: Map<string, Auction> = new Map();
  private readonly metricsService: AuctionMetricsService;
  private readonly fraudDetectionService: AuctionFraudDetectionService;

  private readonly auctionTimeouts = {
    [TaskPriority.HIGH]: 2 * 60 * 1000, // 2 minutes
    [TaskPriority.MEDIUM]: 5 * 60 * 1000, // 5 minutes
    [TaskPriority.LOW]: 10 * 60 * 1000, // 10 minutes
  };

  constructor(
    logger: Logger,
    metricsService: AuctionMetricsService,
    fraudDetectionService: AuctionFraudDetectionService
  ) {
    this.logger = logger.child({ service: 'Auction' });
    this.metricsService = metricsService;
    this.fraudDetectionService = fraudDetectionService;
  }

  async createAuction(task: VerificationTask, eligibleWorkers: WorkerProfile[]): Promise<string> {
    try {
      this.validateAuctionRequirements(task, eligibleWorkers);

      const auctionId = `auction_${task.taskId}_${Date.now()}`;
      const auction: Auction = {
        auctionId,
        taskId: task.taskId,
        status: 'OPEN',
        startTime: Date.now(),
        endTime: Date.now() + this.getAuctionTimeout(task.priority),
        minBid: this.calculateMinBid(task),
        maxBid: this.calculateMaxBid(task),
        bids: [],
      };

      this.auctions.set(auctionId, auction);

      // Schedule auction closing
      setTimeout(() => this.closeAuction(auctionId), auction.endTime - auction.startTime);

      this.logger.info('Created new auction', {
        auctionId,
        taskId: task.taskId,
        eligibleWorkers: eligibleWorkers.length,
      });

      return auctionId;
    } catch (error) {
      this.logger.error('Failed to create auction', {
        error,
        taskId: task.taskId,
      });
      throw new AuctionError('Failed to create auction', { cause: error });
    }
  }

  async placeBid(auctionId: string, workerId: string, amount: number): Promise<boolean> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new AuctionError(`Auction ${auctionId} not found`);
    }

    if (auction.status !== 'OPEN') {
      throw new AuctionError(`Auction ${auctionId} is not open`);
    }

    if (amount < auction.minBid || amount > auction.maxBid) {
      throw new ValidationError('Bid amount outside allowed range');
    }

    const bid: Bid = {
      workerId,
      amount,
      timestamp: Date.now(),
    };

    // Check for fraud before accepting bid
    const fraudCheck = await this.fraudDetectionService.analyzeBids(
      auctionId,
      [...auction.bids, bid],
      auction.metadata?.eligibleWorkers || []
    );

    if (fraudCheck.riskLevel === 'HIGH') {
      this.logger.warn('Suspicious bid detected', {
        auctionId,
        workerId,
        fraudCheck,
      });
      throw new ValidationError('Bid rejected due to suspicious activity');
    }

    auction.bids.push(bid);
    this.logger.info('Bid placed', {
      auctionId,
      workerId,
      amount,
      fraudRiskLevel: fraudCheck.riskLevel,
    });

    return true;
  }

  async closeAuction(auctionId: string): Promise<TaskAssignment[]> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new AuctionError(`Auction ${auctionId} not found`);
    }

    if (auction.status === 'CLOSED') {
      throw new AuctionError(`Auction ${auctionId} already closed`);
    }

    // Final fraud check before closing
    const fraudCheck = await this.fraudDetectionService.analyzeBids(
      auctionId,
      auction.bids,
      auction.metadata?.eligibleWorkers || []
    );

    if (fraudCheck.hasSuspiciousActivity) {
      this.logger.warn('Suspicious activity detected in auction', {
        auctionId,
        fraudCheck,
      });

      // Filter out suspicious bids
      auction.bids = this.filterSuspiciousBids(auction.bids, fraudCheck);
    }

    auction.status = 'CLOSED';
    auction.winners = this.determineWinners(auction);

    const assignments: TaskAssignment[] = auction.winners.map(workerId => ({
      taskId: auction.taskId,
      workerId,
      assignedAt: Date.now(),
      status: 'PENDING',
      expiresAt: Date.now() + this.getAssignmentTimeout(auction.taskId),
      metadata: {
        auctionId: auction.auctionId,
        winningBid: this.getWinningBid(auction, workerId),
        fraudCheckResult: fraudCheck,
      },
    }));

    // Create auction result and track metrics
    const result: AuctionResult = {
      auctionId: auction.auctionId,
      taskId: auction.taskId,
      winners: auction.winners.map(workerId => ({
        workerId,
        winningBid: this.getWinningBid(auction, workerId),
      })),
      totalBids: auction.bids.length,
      startTime: auction.startTime,
      endTime: auction.endTime,
      metadata: {
        ...auction.metadata,
        eligibleWorkers: auction.metadata?.eligibleWorkers,
        requiredWinners: auction.metadata?.requiredWinners,
        fraudDetection: fraudCheck,
      },
    };

    await this.metricsService.trackAuctionResult(result);

    this.logger.info('Auction closed', {
      auctionId,
      winners: auction.winners,
      totalBids: auction.bids.length,
      fraudRiskLevel: fraudCheck.riskLevel,
    });

    return assignments;
  }

  async cancelAuction(auctionId: string): Promise<void> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new AuctionError(`Auction ${auctionId} not found`);
    }

    auction.status = 'CANCELLED';
    this.logger.info('Auction cancelled', { auctionId });
  }

  async getAuctionStatus(auctionId: string): Promise<Auction> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new AuctionError(`Auction ${auctionId} not found`);
    }
    return auction;
  }

  private validateAuctionRequirements(
    task: VerificationTask,
    eligibleWorkers: WorkerProfile[]
  ): void {
    if (eligibleWorkers.length < task.requirements.minSubmissions) {
      throw new ValidationError('Insufficient eligible workers for auction');
    }
  }

  private determineWinners(auction: Auction): string[] {
    // Sort bids by amount (descending) and timestamp
    const sortedBids = [...auction.bids].sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      return a.timestamp - b.timestamp;
    });

    // Get unique workers with highest bids
    const winners = new Set<string>();
    for (const bid of sortedBids) {
      winners.add(bid.workerId);
      if (winners.size >= this.getRequiredWinners(auction.taskId)) {
        break;
      }
    }

    return Array.from(winners);
  }

  private getWinningBid(auction: Auction, workerId: string): number {
    const workerBids = auction.bids
      .filter(bid => bid.workerId === workerId)
      .sort((a, b) => b.amount - a.amount);

    return workerBids[0]?.amount || 0;
  }

  private async calculateMinBid(task: VerificationTask): Promise<number> {
    // Get recommended bid range from metrics
    const recommendedRange = await this.metricsService.getRecommendedBidRange(
      task.type,
      task.requirements.workerLevel,
      task.priority
    );

    if (recommendedRange) {
      return recommendedRange.min;
    }

    // Fallback to base calculation if no history
    let minBid = 1;

    // Adjust for worker level requirement
    if (task.requirements.workerLevel) {
      const levelMultipliers = {
        BEGINNER: 1,
        INTERMEDIATE: 1.5,
        ADVANCED: 2,
        EXPERT: 3,
      };
      minBid *= levelMultipliers[task.requirements.workerLevel] || 1;
    }

    // Adjust for task priority
    const priorityMultipliers = {
      [TaskPriority.LOW]: 1,
      [TaskPriority.MEDIUM]: 1.5,
      [TaskPriority.HIGH]: 2,
    };
    minBid *= priorityMultipliers[task.priority] || 1;

    return Math.round(minBid);
  }

  private async calculateMaxBid(task: VerificationTask): Promise<number> {
    // Get recommended bid range from metrics
    const recommendedRange = await this.metricsService.getRecommendedBidRange(
      task.type,
      task.requirements.workerLevel,
      task.priority
    );

    if (recommendedRange) {
      return recommendedRange.max;
    }

    // Fallback to base calculation if no history
    let maxBid = 100;

    // Adjust for worker level requirement
    if (task.requirements.workerLevel) {
      const levelMultipliers = {
        BEGINNER: 1,
        INTERMEDIATE: 1.5,
        ADVANCED: 2.5,
        EXPERT: 4,
      };
      maxBid *= levelMultipliers[task.requirements.workerLevel] || 1;
    }

    // Adjust for task priority
    const priorityMultipliers = {
      [TaskPriority.LOW]: 1,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.HIGH]: 3,
    };
    maxBid *= priorityMultipliers[task.priority] || 1;

    // Adjust for task complexity if available
    if (task.metadata?.complexity) {
      const complexityMultipliers = {
        LOW: 1,
        MEDIUM: 1.5,
        HIGH: 2,
      };
      maxBid *= complexityMultipliers[task.metadata.complexity] || 1;
    }

    return Math.round(maxBid);
  }

  private getAuctionTimeout(priority: TaskPriority): number {
    return this.auctionTimeouts[priority] || this.auctionTimeouts[TaskPriority.MEDIUM];
  }

  private getAssignmentTimeout(taskId: string): number {
    // TODO: Get task priority and calculate timeout
    return 30 * 60 * 1000; // 30 minutes default
  }

  private getRequiredWinners(taskId: string): number {
    // TODO: Get task requirements
    return 3; // Default minimum submissions
  }

  private filterSuspiciousBids(bids: Bid[], fraudCheck: FraudDetectionResult): Bid[] {
    const suspiciousWorkers = new Set(
      fraudCheck.workerBehaviorAnalysis
        .filter(behavior => behavior.riskScore > 0.7)
        .map(behavior => behavior.workerId)
    );

    return bids.filter(bid => !suspiciousWorkers.has(bid.workerId));
  }
}
