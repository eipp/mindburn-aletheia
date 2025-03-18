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
  totalTasks: number;
  recentAccuracy: number;
  recentTaskCount: number;
  specializations: string[];
}

export class MetricsCollector {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly activitiesTable = 'WorkerActivities';
  private readonly metricsTable = 'WorkerMetrics';
  private readonly resultsTable = 'Results';

  constructor(
    private accuracyWindowDays: number = 30,
    private specializationThreshold: number = 0.2,
    private expertiseThresholds = {
      [ExpertiseLevel.NOVICE]: { tasks: 0, accuracy: 0 },
      [ExpertiseLevel.INTERMEDIATE]: { tasks: 50, accuracy: 0.7 },
      [ExpertiseLevel.EXPERT]: { tasks: 200, accuracy: 0.85 },
      [ExpertiseLevel.MASTER]: { tasks: 1000, accuracy: 0.95 },
    }
  ) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async updateMetrics(workerId: string): Promise<WorkerMetrics> {
    try {
      // Get recent activity
      const recentActivity = await this.getRecentActivity(workerId);

      // Get current metrics
      const currentMetrics = await this.getWorkerMetrics(workerId);

      // Calculate new metrics
      const newMetrics = await this.calculateMetrics(workerId, recentActivity, currentMetrics);

      // Update expertise level if needed
      newMetrics.expertiseLevel = this.determineExpertiseLevel(newMetrics);

      // Update specializations
      newMetrics.specializations = this.determineSpecializations(newMetrics.taskTypeDistribution);

      // Save updated metrics
      await this.saveMetrics(newMetrics);

      return newMetrics;
    } catch (error) {
      console.error('Metrics update error:', error);
      throw error;
    }
  }

  private async getRecentActivity(workerId: string): Promise<WorkerActivity[]> {
    const timeWindow = Date.now() - this.accuracyWindowDays * 24 * 60 * 60 * 1000;

    const result = await this.dynamodb
      .query({
        TableName: this.activitiesTable,
        KeyConditionExpression: 'workerId = :workerId AND #ts >= :timeWindow',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':workerId': workerId,
          ':timeWindow': timeWindow,
        },
      })
      .promise();

    return result.Items as WorkerActivity[];
  }

  private async getWorkerMetrics(workerId: string): Promise<WorkerMetrics | null> {
    const result = await this.dynamodb
      .get({
        TableName: this.metricsTable,
        Key: { workerId },
      })
      .promise();

    return (result.Item as WorkerMetrics) || null;
  }

  private async calculateMetrics(
    workerId: string,
    recentActivity: WorkerActivity[],
    currentMetrics: WorkerMetrics | null
  ): Promise<WorkerMetrics> {
    // Calculate basic metrics
    const processingTimes = recentActivity.map(a => a.processingTime);
    const averageProcessingTime =
      processingTimes.reduce((sum, time) => sum + time, 0) / (processingTimes.length || 1);

    const decisions = recentActivity.map(a => a.decision);
    const approvedCount = decisions.filter(d => d === 'APPROVED').length;
    const rejectedCount = decisions.length - approvedCount;

    // Calculate task type distribution
    const taskTypeDistribution = recentActivity.reduce(
      (dist, activity) => {
        dist[activity.taskType] = (dist[activity.taskType] || 0) + 1;
        return dist;
      },
      {} as Record<string, number>
    );

    // Calculate accuracy
    const recentAccuracy = await this.calculateAccuracy(workerId, recentActivity);

    // Update total metrics
    const totalTasks = (currentMetrics?.totalTasks || 0) + recentActivity.length;
    const accuracyScore = currentMetrics
      ? (currentMetrics.accuracyScore * currentMetrics.totalTasks +
          recentAccuracy * recentActivity.length) /
        totalTasks
      : recentAccuracy;

    return {
      workerId,
      expertiseLevel: currentMetrics?.expertiseLevel || ExpertiseLevel.NOVICE,
      averageProcessingTime,
      decisionDistribution: {
        approved: approvedCount,
        rejected: rejectedCount,
      },
      taskTypeDistribution,
      accuracyScore,
      lastUpdate: Date.now(),
      totalTasks,
      recentAccuracy,
      recentTaskCount: recentActivity.length,
      specializations: currentMetrics?.specializations || [],
    };
  }

  private async calculateAccuracy(
    workerId: string,
    recentActivity: WorkerActivity[]
  ): Promise<number> {
    if (recentActivity.length === 0) return 0;

    // Get verification results for tasks
    const taskIds = recentActivity.map(a => a.taskId);
    const results = await this.getTaskResults(taskIds);

    // Calculate accuracy based on consensus
    let correctDecisions = 0;

    for (const activity of recentActivity) {
      const taskResults = results.filter(r => r.taskId === activity.taskId);
      if (taskResults.length === 0) continue;

      const consensusDecision = this.getConsensusDecision(taskResults);
      if (activity.decision === consensusDecision) {
        correctDecisions++;
      }
    }

    return correctDecisions / recentActivity.length;
  }

  private async getTaskResults(taskIds: string[]): Promise<any[]> {
    // Batch get results for tasks
    const uniqueIds = [...new Set(taskIds)];
    const batchSize = 25; // DynamoDB batch get limit
    const batches = [];

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      batches.push(batch);
    }

    const results = await Promise.all(
      batches.map(batch =>
        this.dynamodb
          .batchGet({
            RequestItems: {
              [this.resultsTable]: {
                Keys: batch.map(id => ({ taskId: id })),
              },
            },
          })
          .promise()
      )
    );

    return results.flatMap(r => r.Responses?.[this.resultsTable] || []);
  }

  private getConsensusDecision(results: any[]): 'APPROVED' | 'REJECTED' {
    const approvedCount = results.filter(r => r.decision === 'APPROVED').length;
    return approvedCount > results.length / 2 ? 'APPROVED' : 'REJECTED';
  }

  private determineExpertiseLevel(metrics: WorkerMetrics): ExpertiseLevel {
    // Start from highest level and work down
    const levels = [
      ExpertiseLevel.MASTER,
      ExpertiseLevel.EXPERT,
      ExpertiseLevel.INTERMEDIATE,
      ExpertiseLevel.NOVICE,
    ];

    for (const level of levels) {
      const threshold = this.expertiseThresholds[level];
      if (metrics.totalTasks >= threshold.tasks && metrics.accuracyScore >= threshold.accuracy) {
        return level;
      }
    }

    return ExpertiseLevel.NOVICE;
  }

  private determineSpecializations(taskTypeDistribution: Record<string, number>): string[] {
    const totalTasks = Object.values(taskTypeDistribution).reduce((sum, count) => sum + count, 0);

    return Object.entries(taskTypeDistribution)
      .filter(([_, count]) => count / totalTasks >= this.specializationThreshold)
      .map(([taskType]) => taskType);
  }

  private async saveMetrics(metrics: WorkerMetrics): Promise<void> {
    try {
      await this.dynamodb
        .put({
          TableName: this.metricsTable,
          Item: metrics,
        })
        .promise();
    } catch (error) {
      console.error('Error saving metrics:', error);
      throw error;
    }
  }
}
