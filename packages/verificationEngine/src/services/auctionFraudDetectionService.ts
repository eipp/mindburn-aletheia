import { Logger } from '@mindburn/shared/logger';
import {
  AuctionBid,
  AuctionResult,
  WorkerProfile,
  FraudDetectionResult,
  SuspiciousActivity,
  FraudPattern,
  WorkerBehavior
} from '../types';
import { AuctionMetricsService } from './auctionMetricsService';

interface BidPattern {
  workerId: string;
  pattern: number[];
  timestamp: number;
}

interface CollaborationPattern {
  workers: string[];
  bids: AuctionBid[];
  confidence: number;
}

export class AuctionFraudDetectionService {
  private readonly logger: Logger;
  private readonly metricsService: AuctionMetricsService;
  private readonly bidPatterns: Map<string, BidPattern[]> = new Map();
  private readonly workerCollaborations: Map<string, CollaborationPattern[]> = new Map();

  // Configuration
  private readonly patternWindow = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxBidDeviation = 0.2; // 20% from average
  private readonly minCollaborationConfidence = 0.8;
  private readonly maxSimilarBids = 3;
  private readonly minTimeBetweenBids = 1000; // 1 second

  constructor(
    logger: Logger,
    metricsService: AuctionMetricsService
  ) {
    this.logger = logger.child({ service: 'AuctionFraudDetection' });
    this.metricsService = metricsService;
  }

  async analyzeBids(
    auctionId: string,
    bids: AuctionBid[],
    workers: WorkerProfile[]
  ): Promise<FraudDetectionResult> {
    try {
      const suspiciousActivities: SuspiciousActivity[] = [];
      const workerBehaviors: WorkerBehavior[] = [];

      // Analyze bid patterns
      const bidPatterns = await this.detectBidPatterns(bids);
      if (bidPatterns.length > 0) {
        suspiciousActivities.push({
          type: 'SUSPICIOUS_BID_PATTERN',
          description: 'Detected suspicious bidding patterns',
          evidence: bidPatterns,
          severity: 'MEDIUM'
        });
      }

      // Detect worker collusion
      const collusion = await this.detectCollusion(bids, workers);
      if (collusion.length > 0) {
        suspiciousActivities.push({
          type: 'WORKER_COLLUSION',
          description: 'Detected potential worker collusion',
          evidence: collusion,
          severity: 'HIGH'
        });
      }

      // Check for automated bidding
      const automatedBids = await this.detectAutomatedBidding(bids);
      if (automatedBids.length > 0) {
        suspiciousActivities.push({
          type: 'AUTOMATED_BIDDING',
          description: 'Detected potential automated bidding',
          evidence: automatedBids,
          severity: 'HIGH'
        });
      }

      // Analyze worker behavior
      for (const worker of workers) {
        const behavior = await this.analyzeWorkerBehavior(worker.workerId, bids);
        if (behavior) {
          workerBehaviors.push(behavior);
        }
      }

      const riskLevel = this.calculateRiskLevel(suspiciousActivities);

      return {
        hasSuspiciousActivity: suspiciousActivities.length > 0,
        suspiciousActivities,
        riskLevel,
        workerBehaviorAnalysis: workerBehaviors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Fraud detection analysis failed', {
        error,
        auctionId
      });
      throw error;
    }
  }

  private async detectBidPatterns(bids: AuctionBid[]): Promise<FraudPattern[]> {
    const patterns: FraudPattern[] = [];
    const workerBids = new Map<string, AuctionBid[]>();

    // Group bids by worker
    bids.forEach(bid => {
      const workerBids = workerBids.get(bid.workerId) || [];
      workerBids.push(bid);
      workerBids.set(bid.workerId, workerBids);
    });

    // Analyze each worker's bidding pattern
    for (const [workerId, workerBids] of workerBids.entries()) {
      // Check for rapid successive bids
      const rapidBids = this.detectRapidBids(workerBids);
      if (rapidBids.length > 0) {
        patterns.push({
          workerId,
          type: 'REPEATED_SUBMISSIONS',
          submissionIds: rapidBids.map(bid => bid.metadata?.submissionId || ''),
          confidence: 0.9
        });
      }

      // Check for systematic bid increments
      const systematicBids = this.detectSystematicBids(workerBids);
      if (systematicBids.length > 0) {
        patterns.push({
          workerId,
          type: 'TIMING_PATTERN',
          submissionIds: systematicBids.map(bid => bid.metadata?.submissionId || ''),
          confidence: 0.85
        });
      }
    }

    return patterns;
  }

  private async detectCollusion(
    bids: AuctionBid[],
    workers: WorkerProfile[]
  ): Promise<FraudPattern[]> {
    const patterns: FraudPattern[] = [];
    const workerGroups = new Map<string, Set<string>>();

    // Group workers by similar bid patterns
    for (let i = 0; i < bids.length; i++) {
      for (let j = i + 1; j < bids.length; j++) {
        const bid1 = bids[i];
        const bid2 = bids[j];

        if (this.areBidsSimilar(bid1, bid2)) {
          const group = workerGroups.get(bid1.workerId) || new Set([bid1.workerId]);
          group.add(bid2.workerId);
          workerGroups.set(bid1.workerId, group);
          workerGroups.set(bid2.workerId, group);
        }
      }
    }

    // Analyze worker groups for collusion
    for (const [workerId, group] of workerGroups.entries()) {
      if (group.size >= this.maxSimilarBids) {
        patterns.push({
          workerId,
          type: 'ANSWER_PATTERN',
          submissionIds: Array.from(group),
          confidence: 0.8
        });
      }
    }

    return patterns;
  }

  private async detectAutomatedBidding(bids: AuctionBid[]): Promise<FraudPattern[]> {
    const patterns: FraudPattern[] = [];
    const workerBids = new Map<string, AuctionBid[]>();

    // Group bids by worker
    bids.forEach(bid => {
      const workerBids = workerBids.get(bid.workerId) || [];
      workerBids.push(bid);
      workerBids.set(bid.workerId, workerBids);
    });

    // Analyze timing patterns
    for (const [workerId, bids] of workerBids.entries()) {
      if (this.hasConsistentTimingPattern(bids)) {
        patterns.push({
          workerId,
          type: 'TIMING_PATTERN',
          submissionIds: bids.map(bid => bid.metadata?.submissionId || ''),
          confidence: 0.95
        });
      }
    }

    return patterns;
  }

  private async analyzeWorkerBehavior(
    workerId: string,
    bids: AuctionBid[]
  ): Promise<WorkerBehavior> {
    const workerBids = bids.filter(bid => bid.workerId === workerId);
    const patterns: FraudPattern[] = [];
    let riskScore = 0;

    // Analyze bid amounts
    if (this.hasAnomalousBidAmounts(workerBids)) {
      patterns.push({
        workerId,
        type: 'ANSWER_PATTERN',
        submissionIds: workerBids.map(bid => bid.metadata?.submissionId || ''),
        confidence: 0.7
      });
      riskScore += 0.3;
    }

    // Analyze bid timing
    if (this.hasAnomalousBidTiming(workerBids)) {
      patterns.push({
        workerId,
        type: 'TIMING_PATTERN',
        submissionIds: workerBids.map(bid => bid.metadata?.submissionId || ''),
        confidence: 0.8
      });
      riskScore += 0.4;
    }

    return {
      workerId,
      riskScore,
      patterns,
      lastAnalysis: new Date().toISOString()
    };
  }

  private calculateRiskLevel(
    activities: SuspiciousActivity[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (activities.length === 0) return 'LOW';

    const severityScores = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3
    };

    const totalScore = activities.reduce(
      (score, activity) => score + severityScores[activity.severity],
      0
    );

    const averageScore = totalScore / activities.length;

    if (averageScore >= 2.5) return 'HIGH';
    if (averageScore >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  private detectRapidBids(bids: AuctionBid[]): AuctionBid[] {
    const sortedBids = [...bids].sort((a, b) => a.timestamp - b.timestamp);
    const rapidBids: AuctionBid[] = [];

    for (let i = 1; i < sortedBids.length; i++) {
      const timeDiff = sortedBids[i].timestamp - sortedBids[i - 1].timestamp;
      if (timeDiff < this.minTimeBetweenBids) {
        rapidBids.push(sortedBids[i]);
      }
    }

    return rapidBids;
  }

  private detectSystematicBids(bids: AuctionBid[]): AuctionBid[] {
    const sortedBids = [...bids].sort((a, b) => a.timestamp - b.timestamp);
    const systematicBids: AuctionBid[] = [];
    const increments: number[] = [];

    // Calculate bid increments
    for (let i = 1; i < sortedBids.length; i++) {
      increments.push(sortedBids[i].amount - sortedBids[i - 1].amount);
    }

    // Check for consistent increments
    const isSystematic = increments.every((inc, i) => 
      i === 0 || Math.abs(inc - increments[i - 1]) < 0.01
    );

    if (isSystematic && increments.length > 0) {
      systematicBids.push(...sortedBids);
    }

    return systematicBids;
  }

  private areBidsSimilar(bid1: AuctionBid, bid2: AuctionBid): boolean {
    const amountDiff = Math.abs(bid1.amount - bid2.amount);
    const averageAmount = (bid1.amount + bid2.amount) / 2;
    return amountDiff / averageAmount < this.maxBidDeviation;
  }

  private hasConsistentTimingPattern(bids: AuctionBid[]): boolean {
    if (bids.length < 3) return false;

    const intervals: number[] = [];
    const sortedBids = [...bids].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedBids.length; i++) {
      intervals.push(sortedBids[i].timestamp - sortedBids[i - 1].timestamp);
    }

    // Check if intervals are consistent
    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return intervals.every(interval => 
      Math.abs(interval - averageInterval) < this.minTimeBetweenBids
    );
  }

  private hasAnomalousBidAmounts(bids: AuctionBid[]): boolean {
    if (bids.length < 2) return false;

    const amounts = bids.map(bid => bid.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const deviation = Math.sqrt(
      amounts.reduce((sq, n) => sq + Math.pow(n - average, 2), 0) / amounts.length
    );

    return deviation / average > this.maxBidDeviation;
  }

  private hasAnomalousBidTiming(bids: AuctionBid[]): boolean {
    if (bids.length < 3) return false;

    const intervals = [];
    const sortedBids = [...bids].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedBids.length; i++) {
      intervals.push(sortedBids[i].timestamp - sortedBids[i - 1].timestamp);
    }

    const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const deviation = Math.sqrt(
      intervals.reduce((sq, n) => sq + Math.pow(n - average, 2), 0) / intervals.length
    );

    return deviation / average < 0.1; // Suspiciously consistent timing
  }
} 