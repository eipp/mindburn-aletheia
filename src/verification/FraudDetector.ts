import { DynamoDB } from 'aws-sdk';
import { ExpertiseLevel } from './types';

interface WorkerActivity {
  workerId: string;
  taskId: string;
  taskType: string;
  decision: 'APPROVED' | 'REJECTED';
  processingTime: number;
  timestamp: number;
}

interface WorkerMetrics {
  workerId: string;
  expertiseLevel: ExpertiseLevel;
  averageProcessingTime: number;
  decisionDistribution: {
    approved: number;
    rejected: number;
  };
  taskTypeDistribution: Record<string, number>;
  accuracyScore: number;
  lastUpdate: number;
}

interface FraudDetectionResult {
  isFraudulent: boolean;
  confidence: number;
  reasons: string[];
  riskScore: number;
}

export class FraudDetector {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly activitiesTable = 'WorkerActivities';
  private readonly metricsTable = 'WorkerMetrics';
  private readonly resultsTable = 'Results';

  constructor(
    private timeWindowMinutes: number = 60,
    private suspiciousSpeedThreshold: number = 0.3, // 30% faster than average
    private patternThreshold: number = 0.8,
    private accuracyThreshold: number = 0.6
  ) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async detectFraud(
    workerId: string,
    taskId: string,
    taskType: string,
    decision: 'APPROVED' | 'REJECTED',
    processingTime: number
  ): Promise<FraudDetectionResult> {
    try {
      // Get worker's recent activity
      const recentActivity = await this.getRecentActivity(workerId);
      
      // Get worker's metrics
      const metrics = await this.getWorkerMetrics(workerId);
      
      // Run fraud detection checks
      const speedCheck = this.checkProcessingSpeed(processingTime, metrics.averageProcessingTime);
      const patternCheck = this.checkDecisionPatterns(decision, recentActivity);
      const distributionCheck = this.checkTaskDistribution(taskType, metrics.taskTypeDistribution);
      const accuracyCheck = this.checkAccuracy(metrics.accuracyScore);
      
      // Calculate overall risk score
      const riskScore = this.calculateRiskScore([
        speedCheck,
        patternCheck,
        distributionCheck,
        accuracyCheck
      ]);

      // Determine if fraudulent based on risk score and collect reasons
      const reasons: string[] = [];
      if (speedCheck.isSuspicious) reasons.push(speedCheck.reason);
      if (patternCheck.isSuspicious) reasons.push(patternCheck.reason);
      if (distributionCheck.isSuspicious) reasons.push(distributionCheck.reason);
      if (accuracyCheck.isSuspicious) reasons.push(accuracyCheck.reason);

      // Update activity log
      await this.logActivity({
        workerId,
        taskId,
        taskType,
        decision,
        processingTime,
        timestamp: Date.now()
      });

      return {
        isFraudulent: riskScore >= 0.7,
        confidence: riskScore,
        reasons,
        riskScore
      };
    } catch (error) {
      console.error('Fraud detection error:', error);
      throw error;
    }
  }

  private async getRecentActivity(workerId: string): Promise<WorkerActivity[]> {
    const timeWindow = Date.now() - (this.timeWindowMinutes * 60 * 1000);

    const result = await this.dynamodb.query({
      TableName: this.activitiesTable,
      KeyConditionExpression: 'workerId = :workerId AND #ts >= :timeWindow',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':workerId': workerId,
        ':timeWindow': timeWindow
      }
    }).promise();

    return result.Items as WorkerActivity[];
  }

  private async getWorkerMetrics(workerId: string): Promise<WorkerMetrics> {
    const result = await this.dynamodb.get({
      TableName: this.metricsTable,
      Key: { workerId }
    }).promise();

    return result.Item as WorkerMetrics;
  }

  private checkProcessingSpeed(
    currentTime: number,
    averageTime: number
  ): { isSuspicious: boolean; reason: string; score: number } {
    const speedRatio = currentTime / averageTime;
    const isSuspicious = speedRatio <= this.suspiciousSpeedThreshold;
    
    return {
      isSuspicious,
      reason: isSuspicious ? 
        `Processing time ${Math.round(speedRatio * 100)}% of average` : '',
      score: isSuspicious ? (1 - speedRatio) : 0
    };
  }

  private checkDecisionPatterns(
    currentDecision: 'APPROVED' | 'REJECTED',
    recentActivity: WorkerActivity[]
  ): { isSuspicious: boolean; reason: string; score: number } {
    if (recentActivity.length < 5) {
      return { isSuspicious: false, reason: '', score: 0 };
    }

    // Check for repetitive patterns
    const decisions = recentActivity.map(a => a.decision);
    const pattern = this.detectPattern(decisions);
    
    if (pattern) {
      return {
        isSuspicious: true,
        reason: `Repetitive decision pattern detected: ${pattern}`,
        score: 0.8
      };
    }

    // Check for unusual distribution
    const approvalRate = decisions.filter(d => d === 'APPROVED').length / decisions.length;
    const isUnbalanced = approvalRate <= 0.1 || approvalRate >= 0.9;

    return {
      isSuspicious: isUnbalanced,
      reason: isUnbalanced ? 
        `Unusual decision distribution: ${Math.round(approvalRate * 100)}% approvals` : '',
      score: isUnbalanced ? 0.6 : 0
    };
  }

  private checkTaskDistribution(
    taskType: string,
    distribution: Record<string, number>
  ): { isSuspicious: boolean; reason: string; score: number } {
    const totalTasks = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const typeCount = distribution[taskType] || 0;
    const typeRatio = typeCount / totalTasks;

    const isSuspicious = typeRatio >= this.patternThreshold;

    return {
      isSuspicious,
      reason: isSuspicious ? 
        `${Math.round(typeRatio * 100)}% of tasks are ${taskType}` : '',
      score: isSuspicious ? typeRatio : 0
    };
  }

  private checkAccuracy(accuracyScore: number): { isSuspicious: boolean; reason: string; score: number } {
    const isSuspicious = accuracyScore < this.accuracyThreshold;

    return {
      isSuspicious,
      reason: isSuspicious ? 
        `Low accuracy score: ${Math.round(accuracyScore * 100)}%` : '',
      score: isSuspicious ? (1 - accuracyScore) : 0
    };
  }

  private calculateRiskScore(
    checks: Array<{ isSuspicious: boolean; score: number }>
  ): number {
    const weights = {
      speed: 0.3,
      pattern: 0.3,
      distribution: 0.2,
      accuracy: 0.2
    };

    return checks.reduce((total, check, index) => {
      const weight = Object.values(weights)[index];
      return total + (check.score * weight);
    }, 0);
  }

  private detectPattern(decisions: string[]): string | null {
    // Check for simple alternating pattern
    const isAlternating = decisions.every((d, i) => 
      i === 0 || d !== decisions[i - 1]
    );
    if (isAlternating) return 'Alternating decisions';

    // Check for repeating sequence
    for (let length = 2; length <= 3; length++) {
      const sequence = decisions.slice(0, length).join('-');
      const isRepeating = decisions.every((d, i) => 
        d === decisions[i % length]
      );
      if (isRepeating) return `Repeating sequence: ${sequence}`;
    }

    return null;
  }

  private async logActivity(activity: WorkerActivity): Promise<void> {
    try {
      await this.dynamodb.put({
        TableName: this.activitiesTable,
        Item: activity
      }).promise();
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
} 