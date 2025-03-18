import { WorkflowHandler } from './base';
import { PaymentProcessingOutput, TaskCompletionOutput } from '../types/workflow';
import { createEnvironmentTransformer } from '@mindburn/shared';
import { EventBridge, SNS } from 'aws-sdk';

interface Config {
  eventBusName: string;
  notificationTopicArn: string;
}

export class CompletionNotifier extends WorkflowHandler {
  private readonly eventBridge: EventBridge;
  private readonly sns: SNS;
  private readonly config: Config;

  constructor() {
    super('Tasks');
    this.eventBridge = new EventBridge();
    this.sns = new SNS();
    this.config = createEnvironmentTransformer<Config>(process.env);
  }

  async handler(input: PaymentProcessingOutput): Promise<TaskCompletionOutput> {
    try {
      const { taskId, payments } = input;

      // Get task details
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Calculate completion metrics
      const metrics = {
        totalVerifiers: payments.length,
        consensusScore: task.confidenceScore || 0,
        averageResponseTime: this.calculateAverageResponseTime(
          task.verificationStartTime,
          task.verificationResults || []
        )
      };

      // Determine completion status
      const status = this.determineCompletionStatus(task, payments);

      // Send completion event
      await this.emitCompletionEvent(taskId, status, metrics);

      // Send notifications
      await this.sendNotifications(taskId, status, metrics);

      // Update task status
      await this.updateTask(taskId,
        'SET #status = :status, completionTime = :time, metrics = :metrics',
        {
          ':status': status,
          ':time': new Date().toISOString(),
          ':metrics': metrics,
          '#status': 'status'
        }
      );

      this.logger.info('Task completion processed', {
        taskId,
        status,
        metrics
      });

      return {
        taskId,
        status,
        completionTime: new Date().toISOString(),
        metrics
      };
    } catch (error) {
      this.logger.error('Completion notification failed', { error, input });
      throw error;
    }
  }

  private calculateAverageResponseTime(startTime: string, results: any[]): number {
    if (results.length === 0) return 0;

    const start = new Date(startTime).getTime();
    const totalTime = results.reduce((sum, result) => {
      const responseTime = new Date(result.timestamp).getTime() - start;
      return sum + responseTime;
    }, 0);

    return totalTime / results.length / 1000; // Convert to seconds
  }

  private determineCompletionStatus(
    task: any,
    payments: { status: string }[]
  ): 'success' | 'failure' {
    const allPaymentsProcessed = payments.every(p => p.status === 'processed');
    const hasConsensus = task.confidenceScore >= 0.7; // Threshold from config
    
    return allPaymentsProcessed && hasConsensus ? 'success' : 'failure';
  }

  private async emitCompletionEvent(
    taskId: string,
    status: string,
    metrics: any
  ): Promise<void> {
    await this.eventBridge.putEvents({
      Entries: [{
        Source: 'aletheia.task-completion',
        DetailType: 'TaskCompleted',
        Detail: JSON.stringify({
          taskId,
          status,
          metrics,
          timestamp: Date.now()
        }),
        EventBusName: this.config.eventBusName
      }]
    }).promise();
  }

  private async sendNotifications(
    taskId: string,
    status: string,
    metrics: any
  ): Promise<void> {
    const message = {
      taskId,
      status,
      metrics,
      timestamp: new Date().toISOString()
    };

    await this.sns.publish({
      TopicArn: this.config.notificationTopicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: taskId
        },
        status: {
          DataType: 'String',
          StringValue: status
        }
      }
    }).promise();
  }
}

export const handler = new CompletionNotifier().handler.bind(new CompletionNotifier()); 