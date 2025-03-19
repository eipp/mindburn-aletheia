import { Logger } from '@mindburn/shared/logger';
import { SNS } from '@aws-sdk/client-sns';
import {
  NotificationType,
  NotificationTemplate,
  NotificationChannel,
  NotificationPriority,
  WorkerProfile,
  WorkerStatus,
} from '../types';

interface NotificationConfig {
  retryAttempts: number;
  retryDelayMs: number;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  template: NotificationTemplate;
}

export class NotificationService {
  private readonly logger: Logger;
  private readonly sns: SNS;
  private readonly topicArn: string;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 5000, 15000]; // Exponential backoff

  private readonly notificationConfigs: Record<NotificationType, NotificationConfig> = {
    TASK_ASSIGNED: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      channels: ['TELEGRAM', 'SNS'],
      priority: 'HIGH',
      template: 'TASK_ASSIGNMENT',
    },
    TASK_EXPIRED: {
      retryAttempts: 2,
      retryDelayMs: 2000,
      channels: ['TELEGRAM', 'SNS'],
      priority: 'MEDIUM',
      template: 'TASK_EXPIRATION',
    },
    AUCTION_STARTED: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      channels: ['TELEGRAM', 'SNS'],
      priority: 'HIGH',
      template: 'AUCTION_ANNOUNCEMENT',
    },
    AUCTION_WON: {
      retryAttempts: 2,
      retryDelayMs: 2000,
      channels: ['TELEGRAM', 'SNS'],
      priority: 'HIGH',
      template: 'AUCTION_RESULT',
    },
    PAYMENT_RECEIVED: {
      retryAttempts: 1,
      retryDelayMs: 5000,
      channels: ['TELEGRAM'],
      priority: 'LOW',
      template: 'PAYMENT_CONFIRMATION',
    },
    STATUS_CHANGE: {
      retryAttempts: 2,
      retryDelayMs: 2000,
      channels: ['TELEGRAM'],
      priority: 'MEDIUM',
      template: 'STATUS_UPDATE',
    },
    WORKLOAD_WARNING: {
      retryAttempts: 1,
      retryDelayMs: 1000,
      channels: ['TELEGRAM'],
      priority: 'HIGH',
      template: 'WORKLOAD_WARNING',
    },
    PERFORMANCE_ALERT: {
      retryAttempts: 2,
      retryDelayMs: 2000,
      channels: ['TELEGRAM'],
      priority: 'HIGH',
      template: 'PERFORMANCE_ALERT',
    },
    ONBOARDING_STARTED: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      channels: ['TELEGRAM'],
      priority: 'HIGH',
      template: 'onboarding_started',
    },
    ONBOARDING_STEP_COMPLETED: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      channels: ['TELEGRAM'],
      priority: 'HIGH',
      template: 'onboarding_step',
    },
    ONBOARDING_COMPLETED: {
      retryAttempts: 3,
      retryDelayMs: 1000,
      channels: ['TELEGRAM'],
      priority: 'HIGH',
      template: 'onboarding_completed',
    },
  };

  constructor(logger: Logger, sns: SNS, topicArn: string) {
    this.logger = logger.child({ service: 'Notification' });
    this.sns = sns;
    this.topicArn = topicArn;
  }

  async notifyWorker(
    workerId: string,
    type: NotificationType,
    data: Record<string, any>
  ): Promise<void> {
    const config = this.notificationConfigs[type];
    if (!config) {
      throw new Error(`Invalid notification type: ${type}`);
    }

    const notification = {
      workerId,
      type,
      data,
      timestamp: new Date().toISOString(),
      priority: config.priority,
    };

    try {
      await this.sendWithRetry(notification, config);
    } catch (error) {
      this.logger.error('Failed to send notification after retries', {
        error,
        workerId,
        type,
      });
      throw error;
    }
  }

  private async sendWithRetry(
    notification: any,
    config: NotificationConfig,
    attempt: number = 0
  ): Promise<void> {
    try {
      await this.publishToSNS(notification);

      this.logger.info('Notification sent successfully', {
        workerId: notification.workerId,
        type: notification.type,
        attempt: attempt + 1,
      });
    } catch (error) {
      if (attempt < config.retryAttempts) {
        this.logger.warn('Notification failed, retrying', {
          error,
          workerId: notification.workerId,
          type: notification.type,
          attempt: attempt + 1,
        });

        await this.delay(this.retryDelays[attempt]);
        return this.sendWithRetry(notification, config, attempt + 1);
      }
      throw error;
    }
  }

  private async publishToSNS(notification: any): Promise<void> {
    const message = {
      default: JSON.stringify(notification),
      telegram: this.formatTelegramMessage(notification),
      sms: this.formatSMSMessage(notification),
    };

    await this.sns.publish({
      TopicArn: this.topicArn,
      Message: JSON.stringify(message),
      MessageStructure: 'json',
    });
  }

  private formatTelegramMessage(notification: any): string {
    const templates: Record<NotificationTemplate, (data: any) => string> = {
      TASK_ASSIGNMENT: data =>
        `
🎯 New Task Assignment

Task ID: ${data.taskId}
Type: ${data.type}
Expires: ${new Date(data.expiresAt).toLocaleString()}

Tap to view details and start working!
      `.trim(),

      TASK_EXPIRATION: data =>
        `
⚠️ Task Expired

Task ID: ${data.taskId}
Reason: ${data.reason}

The task has been reassigned.
      `.trim(),

      AUCTION_ANNOUNCEMENT: data =>
        `
🔔 New Task Auction

Task ID: ${data.taskId}
Min Bid: ${data.minBid} TON
Duration: ${data.duration} minutes

Place your bid now!
      `.trim(),

      AUCTION_RESULT: data =>
        `
🎉 Auction Won!

Task ID: ${data.taskId}
Your Bid: ${data.winningBid} TON

The task has been assigned to you.
      `.trim(),

      PAYMENT_CONFIRMATION: data =>
        `
💰 Payment Received

Amount: ${data.amount} TON
Task ID: ${data.taskId}
Transaction: ${data.txHash}

Thank you for your work!
      `.trim(),

      STATUS_UPDATE: data =>
        `
📊 Status Update

Your status has changed from ${data.oldStatus} to ${data.newStatus}
${data.reason ? `\nReason: ${data.reason}` : ''}

${this.getStatusUpdateAdvice(data.newStatus)}
      `.trim(),

      WORKLOAD_WARNING: data =>
        `
⚠️ Workload Warning

You currently have ${data.activeTaskCount} active tasks
Maximum allowed: ${data.maxTasks}

Please complete some tasks before accepting new ones.
      `.trim(),

      PERFORMANCE_ALERT: data =>
        `
🚨 Performance Alert

Type: ${data.type}
${data.details}

Please take action to maintain your worker status.
      `.trim(),

      ONBOARDING_STARTED: data => `🎉 Welcome to Aletheia! Let's get you started.

Your next step is: ${data.nextStep}

Follow the instructions in the app to complete your registration. If you need help, use the /help command.`,

      ONBOARDING_STEP_COMPLETED: data => `✅ Great job! You've completed: ${data.step}

Next step: ${data.nextStep}

Keep going! You're making excellent progress.`,

      ONBOARDING_COMPLETED: data => `🎊 Congratulations! You've completed the onboarding process.

Your skills: ${data.skills.join(', ')}
Status: ${data.status}

You can now start accepting tasks. Use /help to see available commands.`,
    };

    const template = templates[this.notificationConfigs[notification.type].template];
    return template(notification.data);
  }

  private formatSMSMessage(notification: any): string {
    // Simplified SMS versions of the templates
    return `${notification.type}: ${JSON.stringify(notification.data)}`;
  }

  private getStatusUpdateAdvice(newStatus: WorkerStatus): string {
    switch (newStatus) {
      case WorkerStatus.SUSPENDED:
        return 'Contact support to resolve any issues and restore your status.';
      case WorkerStatus.BUSY:
        return 'Complete your current tasks to become available again.';
      case WorkerStatus.AVAILABLE:
        return 'You can now accept new tasks.';
      default:
        return '';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
