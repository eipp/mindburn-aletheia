import { WorkflowHandler } from './base';
import { TaskFailureOutput } from '../types/workflow';
import { createEnvironmentTransformer } from '@mindburn/shared';
import { EventBridge, SNS } from 'aws-sdk';

interface Config {
  eventBusName: string;
  alertTopicArn: string;
  maxRecoveryAttempts: number;
  recoveryStrategies: {
    timeout: boolean;
    noWorkers: boolean;
    consensusFailed: boolean;
    paymentFailed: boolean;
  };
}

export class FailureHandler extends WorkflowHandler {
  private readonly eventBridge: EventBridge;
  private readonly sns: SNS;
  private readonly config: Config;

  constructor() {
    super('Tasks');
    this.eventBridge = new EventBridge();
    this.sns = new SNS();
    this.config = createEnvironmentTransformer<Config>(process.env);
  }

  async handler(input: any): Promise<TaskFailureOutput> {
    try {
      const { taskId, error } = input;

      // Get task details
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Analyze failure and determine if recoverable
      const { failureReason, isRecoverable } = this.analyzeFailure(error, task);

      // Increment recovery attempts if applicable
      const recoveryAttempts = (task.recoveryAttempts || 0) + 1;
      const canRetry = isRecoverable && 
        recoveryAttempts <= this.config.maxRecoveryAttempts;

      // Update task status
      await this.updateTask(taskId,
        'SET #status = :status, failureReason = :reason, recoveryAttempts = :attempts, updatedAt = :now',
        {
          ':status': canRetry ? 'pending_retry' : 'failed',
          ':reason': failureReason,
          ':attempts': recoveryAttempts,
          ':now': new Date().toISOString(),
          '#status': 'status'
        }
      );

      // Emit failure event
      await this.emitFailureEvent(taskId, failureReason, canRetry);

      // Send failure notification
      await this.sendFailureAlert(taskId, failureReason, recoveryAttempts);

      this.logger.info('Task failure handled', {
        taskId,
        failureReason,
        recoveryAttempts,
        canRetry
      });

      return {
        taskId,
        failureReason,
        failureTimestamp: new Date().toISOString(),
        recoveryAttempts,
        isRecoverable: canRetry
      };
    } catch (error) {
      this.logger.error('Failure handling failed', { error, input });
      throw error;
    }
  }

  private analyzeFailure(error: any, task: any): {
    failureReason: string;
    isRecoverable: boolean;
  } {
    // Check for timeout
    if (error.name === 'TaskTimeoutError') {
      return {
        failureReason: 'Task execution timed out',
        isRecoverable: this.config.recoveryStrategies.timeout
      };
    }

    // Check for worker availability
    if (error.name === 'NoWorkersAvailableError') {
      return {
        failureReason: 'No eligible workers available',
        isRecoverable: this.config.recoveryStrategies.noWorkers
      };
    }

    // Check for consensus failure
    if (error.name === 'ConsensusFailedError') {
      return {
        failureReason: 'Failed to reach consensus',
        isRecoverable: this.config.recoveryStrategies.consensusFailed
      };
    }

    // Check for payment failure
    if (error.name === 'PaymentProcessingError') {
      return {
        failureReason: 'Payment processing failed',
        isRecoverable: this.config.recoveryStrategies.paymentFailed
      };
    }

    // Default case
    return {
      failureReason: error.message || 'Unknown error occurred',
      isRecoverable: false
    };
  }

  private async emitFailureEvent(
    taskId: string,
    reason: string,
    canRetry: boolean
  ): Promise<void> {
    await this.eventBridge.putEvents({
      Entries: [{
        Source: 'aletheia.task-failure',
        DetailType: 'TaskFailed',
        Detail: JSON.stringify({
          taskId,
          reason,
          canRetry,
          timestamp: Date.now()
        }),
        EventBusName: this.config.eventBusName
      }]
    }).promise();
  }

  private async sendFailureAlert(
    taskId: string,
    reason: string,
    attempts: number
  ): Promise<void> {
    const message = {
      taskId,
      failureReason: reason,
      recoveryAttempts: attempts,
      timestamp: new Date().toISOString()
    };

    await this.sns.publish({
      TopicArn: this.config.alertTopicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: taskId
        },
        severity: {
          DataType: 'String',
          StringValue: attempts >= this.config.maxRecoveryAttempts ? 'high' : 'medium'
        }
      }
    }).promise();
  }
}

export const handler = new FailureHandler().handler.bind(new FailureHandler()); 