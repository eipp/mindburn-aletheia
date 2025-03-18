import { SQSHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { createLogger, createTelegramService } from '@mindburn/shared';

const logger = createLogger('taskNotificationHandler');
const dynamo = DynamoDBDocument.from(new DynamoDB({}));
const eventBridge = new EventBridge({});
const telegram = createTelegramService();

interface TaskNotification {
  taskId: string;
  workerId: string;
  type: 'new_task' | 'task_reminder' | 'task_expiring' | 'task_completed';
  metadata?: Record<string, any>;
}

export const handler: SQSHandler = async event => {
  const failedNotifications: string[] = [];

  for (const record of event.Records) {
    try {
      const notification: TaskNotification = JSON.parse(record.body);
      logger.info('Processing task notification', {
        taskId: notification.taskId,
        workerId: notification.workerId,
        type: notification.type,
      });

      // Get worker details
      const worker = await dynamo.get({
        TableName: process.env.WORKERS_TABLE!,
        Key: { workerId: notification.workerId },
      });

      if (!worker.Item) {
        logger.warn('Worker not found', { workerId: notification.workerId });
        continue;
      }

      // Get task details
      const task = await dynamo.get({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId: notification.taskId },
      });

      if (!task.Item) {
        logger.warn('Task not found', { taskId: notification.taskId });
        continue;
      }

      // Prepare notification message
      const message = await prepareNotificationMessage(notification, task.Item, worker.Item);

      // Send notification via Telegram
      await telegram.sendMessage({
        chatId: worker.Item.telegramChatId,
        message: message,
        parseMode: 'HTML',
        replyMarkup: prepareReplyMarkup(notification, task.Item),
      });

      // Update notification status in DynamoDB
      await dynamo.update({
        TableName: process.env.WORKERS_TABLE!,
        Key: { workerId: notification.workerId },
        UpdateExpression: 'SET lastNotification = :notification',
        ExpressionAttributeValues: {
          ':notification': {
            type: notification.type,
            taskId: notification.taskId,
            sentAt: new Date().toISOString(),
          },
        },
      });

      // Emit notification sent event
      await eventBridge.putEvents({
        Entries: [
          {
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: 'task-management',
            DetailType: 'TaskNotificationSent',
            Detail: JSON.stringify({
              taskId: notification.taskId,
              workerId: notification.workerId,
              type: notification.type,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });

      logger.info('Task notification sent successfully', {
        taskId: notification.taskId,
        workerId: notification.workerId,
        type: notification.type,
      });
    } catch (error) {
      logger.error('Failed to process notification', { error, record });
      failedNotifications.push(record.messageId);
    }
  }

  // If any notifications failed, throw error to trigger DLQ
  if (failedNotifications.length > 0) {
    throw new Error(`Failed to process notifications: ${failedNotifications.join(', ')}`);
  }
};

function prepareNotificationMessage(
  notification: TaskNotification,
  task: any,
  worker: any
): string {
  const messages = {
    new_task:
      `🆕 New Task Available!\n\n` +
      `Title: ${task.title}\n` +
      `Type: ${task.type}\n` +
      `Reward: ${task.reward} TON\n\n` +
      `Description: ${task.description}\n\n` +
      `Use the buttons below to accept or reject this task.`,

    task_reminder:
      `⏰ Reminder: You have a pending task!\n\n` +
      `Title: ${task.title}\n` +
      `Time remaining: ${notification.metadata?.timeRemaining || 'Unknown'}\n\n` +
      `Please complete this task soon to maintain your performance metrics.`,

    task_expiring:
      `⚠️ Task Expiring Soon!\n\n` +
      `Title: ${task.title}\n` +
      `Time remaining: ${notification.metadata?.timeRemaining || 'Less than 1 hour'}\n\n` +
      `Complete this task soon to avoid it being reassigned.`,

    task_completed:
      `✅ Task Completed Successfully!\n\n` +
      `Title: ${task.title}\n` +
      `Reward: ${task.reward} TON\n` +
      `Time spent: ${notification.metadata?.timeSpent || 'N/A'}\n\n` +
      `Thank you for your contribution! Your reward will be processed shortly.`,
  };

  return messages[notification.type] || 'Task notification';
}

function prepareReplyMarkup(notification: TaskNotification, task: any): any {
  if (notification.type === 'new_task') {
    return {
      inline_keyboard: [
        [
          {
            text: '✅ Accept Task',
            callback_data: `accept_task:${task.taskId}`,
          },
          {
            text: '❌ Reject Task',
            callback_data: `reject_task:${task.taskId}`,
          },
        ],
      ],
    };
  }

  if (notification.type === 'task_reminder' || notification.type === 'task_expiring') {
    return {
      inline_keyboard: [
        [
          {
            text: '🔍 View Task',
            callback_data: `view_task:${task.taskId}`,
          },
        ],
      ],
    };
  }

  return null;
}
