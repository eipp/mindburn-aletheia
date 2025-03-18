import { DynamoDB, SQS, EventBridge } from 'aws-sdk';
import { createLogger, createEnvironmentTransformer } from '@mindburn/shared';
import { Task, TaskDistributionStrategy, WorkerMatchResult } from '../types';
import { WorkerMatcher } from './workerMatcher';

const logger = createLogger('TaskDistributor');
const config = createEnvironmentTransformer(process.env);

export class TaskDistributor {
  private readonly dynamodb: DynamoDB.DocumentClient;
  private readonly sqs: SQS;
  private readonly eventBridge: EventBridge;
  private readonly workerMatcher: WorkerMatcher;

  constructor() {
    this.dynamodb = new DynamoDB.DocumentClient();
    this.sqs = new SQS();
    this.eventBridge = new EventBridge();
    this.workerMatcher = new WorkerMatcher({ minMatchScore: 0.6 });
  }

  async distributeTask(task: Task): Promise<DistributionResult> {
    try {
      // Find eligible workers
      const matchCriteria = {
        taskType: task.verificationRequirements.type,
        requiredSkills: task.verificationRequirements.requiredSkills || [],
        minLevel: task.verificationRequirements.minVerifierLevel,
        languageCodes: task.verificationRequirements.languageCodes,
        urgency: task.verificationRequirements.urgency,
      };

      const eligibleWorkers = await this.workerMatcher.findEligibleWorkers(task, matchCriteria);

      if (eligibleWorkers.length === 0) {
        await this.handleNoEligibleWorkers(task);
        return {
          taskId: task.taskId,
          eligibleWorkers: [],
          distributionStrategy: 'targeted',
          notificationsSent: 0,
          executionId: Date.now().toString(),
        };
      }

      // Determine optimal distribution strategy
      const strategy = this.determineOptimalStrategy(task, eligibleWorkers);

      // Select workers based on strategy
      const selectedWorkers = await this.selectWorkers(eligibleWorkers, strategy, task);

      // Send notifications
      const notificationsSent = await this.notifyWorkers(task, selectedWorkers, strategy);

      // Update task status
      await this.updateTaskStatus(task.taskId, selectedWorkers);

      // Emit distribution event
      await this.emitDistributionEvent(task, selectedWorkers, strategy);

      return {
        taskId: task.taskId,
        eligibleWorkers: selectedWorkers.map(w => w.workerId),
        distributionStrategy: strategy,
        notificationsSent,
        executionId: Date.now().toString(),
      };
    } catch (error) {
      logger.error('Task distribution failed', { error, taskId: task.taskId });
      throw error;
    }
  }

  private determineOptimalStrategy(
    task: Task,
    workers: WorkerMatchResult[]
  ): TaskDistributionStrategy {
    const { urgency } = task.verificationRequirements;
    const workerCount = workers.length;
    const avgMatchScore = workers.reduce((sum, w) => sum + w.matchScore, 0) / workerCount;

    // Critical tasks always use broadcast
    if (urgency === 'critical') {
      return TaskDistributionStrategy.BROADCAST;
    }

    // Few eligible workers use targeted
    if (workerCount <= 5) {
      return TaskDistributionStrategy.TARGETED;
    }

    // High average match score and many workers use auction
    if (avgMatchScore > 0.8 && workerCount > 10) {
      return TaskDistributionStrategy.AUCTION;
    }

    // Default to targeted for balanced approach
    return TaskDistributionStrategy.TARGETED;
  }

  private async selectWorkers(
    workers: WorkerMatchResult[],
    strategy: TaskDistributionStrategy,
    task: Task
  ): Promise<WorkerMatchResult[]> {
    const { verificationThreshold } = task.verificationRequirements;

    switch (strategy) {
      case TaskDistributionStrategy.BROADCAST:
        return workers;

      case TaskDistributionStrategy.TARGETED:
        // Select best matching workers with buffer
        return workers
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, verificationThreshold * 2);

      case TaskDistributionStrategy.AUCTION:
        // Select top performers for auction
        return workers
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, verificationThreshold * 3);

      default:
        return workers.slice(0, verificationThreshold * 2);
    }
  }

  private async notifyWorkers(
    task: Task,
    workers: WorkerMatchResult[],
    strategy: TaskDistributionStrategy
  ): Promise<number> {
    const messages = workers.map(worker => ({
      Id: `${task.taskId}-${worker.workerId}`,
      MessageBody: JSON.stringify({
        taskId: task.taskId,
        workerId: worker.workerId,
        strategy,
        matchScore: worker.matchScore,
        notificationType: 'TASK_AVAILABLE',
      }),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: task.taskId,
        },
        workerId: {
          DataType: 'String',
          StringValue: worker.workerId,
        },
        strategy: {
          DataType: 'String',
          StringValue: strategy,
        },
      },
    }));

    // Send messages in batches
    const batches = this.chunk(messages, 10);
    let notificationsSent = 0;

    for (const batch of batches) {
      try {
        await this.sqs
          .sendMessageBatch({
            QueueUrl: process.env.TASK_NOTIFICATION_QUEUE_URL!,
            Entries: batch,
          })
          .promise();
        notificationsSent += batch.length;
      } catch (error) {
        logger.error('Failed to send notification batch', { error, taskId: task.taskId });
      }
    }

    return notificationsSent;
  }

  private async updateTaskStatus(taskId: string, workers: WorkerMatchResult[]): Promise<void> {
    await this.dynamodb
      .update({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId },
        UpdateExpression: 'SET #status = :status, eligibleWorkers = :workers, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'PENDING_ACCEPTANCE',
          ':workers': workers.map(w => w.workerId),
          ':now': new Date().toISOString(),
        },
      })
      .promise();
  }

  private async emitDistributionEvent(
    task: Task,
    workers: WorkerMatchResult[],
    strategy: TaskDistributionStrategy
  ): Promise<void> {
    await this.eventBridge
      .putEvents({
        Entries: [
          {
            Source: 'aletheia.task-distribution',
            DetailType: 'TaskDistributed',
            Detail: JSON.stringify({
              taskId: task.taskId,
              workerCount: workers.length,
              strategy,
              timestamp: Date.now(),
            }),
            EventBusName: process.env.EVENT_BUS_NAME,
          },
        ],
      })
      .promise();
  }

  private async handleNoEligibleWorkers(task: Task): Promise<void> {
    // Update task status
    await this.dynamodb
      .update({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId: task.taskId },
        UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'FAILED',
          ':reason': 'No eligible workers found',
          ':now': new Date().toISOString(),
        },
      })
      .promise();

    // Emit failure event
    await this.eventBridge
      .putEvents({
        Entries: [
          {
            Source: 'aletheia.task-distribution',
            DetailType: 'TaskDistributionFailed',
            Detail: JSON.stringify({
              taskId: task.taskId,
              reason: 'NO_ELIGIBLE_WORKERS',
              timestamp: Date.now(),
            }),
            EventBusName: process.env.EVENT_BUS_NAME,
          },
        ],
      })
      .promise();
  }

  private chunk<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }
}
