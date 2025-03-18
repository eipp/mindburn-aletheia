import { SQS, EventBridge } from 'aws-sdk';
import { WorkflowHandler } from './base';
import { WorkerMatchingOutput, NotificationOutput } from '../types/workflow';
import { createEnvironmentTransformer } from '@mindburn/shared';

interface Config {
  notificationQueueUrl: string;
  eventBusName: string;
  notificationTimeoutSeconds: number;
}

export class WorkerNotifier extends WorkflowHandler {
  private readonly sqs: SQS;
  private readonly eventBridge: EventBridge;
  private readonly config: Config;

  constructor() {
    super('Workers');
    this.sqs = new SQS();
    this.eventBridge = new EventBridge();
    this.config = createEnvironmentTransformer<Config>(process.env);
  }

  async handler(input: WorkerMatchingOutput): Promise<NotificationOutput> {
    try {
      const { taskId, eligibleWorkers, matchingStrategy } = input;

      // Send notifications based on strategy
      const notificationPromises = eligibleWorkers.map(workerId =>
        this.sendNotification(taskId, workerId, matchingStrategy)
      );

      // Wait for notifications to be sent
      await Promise.all(notificationPromises);

      // Emit notification event
      await this.emitNotificationEvent(taskId, eligibleWorkers, matchingStrategy);

      // Wait for worker responses (simplified - in reality would use a separate process)
      const acceptedWorkers = await this.waitForResponses(taskId, eligibleWorkers);

      this.logger.info('Worker notifications completed', {
        taskId,
        notifiedCount: eligibleWorkers.length,
        acceptedCount: acceptedWorkers.length
      });

      return {
        taskId,
        notifiedWorkers: eligibleWorkers,
        acceptedWorkers,
        notificationTimestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Worker notification failed', { error, input });
      throw error;
    }
  }

  private async sendNotification(taskId: string, workerId: string, strategy: string): Promise<void> {
    const message = {
      taskId,
      workerId,
      strategy,
      timestamp: Date.now(),
      expiresAt: Date.now() + (this.config.notificationTimeoutSeconds * 1000)
    };

    await this.sqs.sendMessage({
      QueueUrl: this.config.notificationQueueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: taskId
        },
        workerId: {
          DataType: 'String',
          StringValue: workerId
        }
      }
    }).promise();
  }

  private async emitNotificationEvent(
    taskId: string,
    workers: string[],
    strategy: string
  ): Promise<void> {
    await this.eventBridge.putEvents({
      Entries: [{
        Source: 'aletheia.worker-notifier',
        DetailType: 'WorkersNotified',
        Detail: JSON.stringify({
          taskId,
          workerCount: workers.length,
          strategy,
          timestamp: Date.now()
        }),
        EventBusName: this.config.eventBusName
      }]
    }).promise();
  }

  private async waitForResponses(taskId: string, workers: string[]): Promise<string[]> {
    // This is a simplified implementation
    // In reality, would implement a proper response collection mechanism
    // possibly using DynamoDB streams or SQS
    await new Promise(resolve => 
      setTimeout(resolve, this.config.notificationTimeoutSeconds * 1000)
    );

    // For now, simulate some workers accepting
    return workers.slice(0, Math.ceil(workers.length * 0.7));
  }
}

export const handler = new WorkerNotifier().handler.bind(new WorkerNotifier()); 