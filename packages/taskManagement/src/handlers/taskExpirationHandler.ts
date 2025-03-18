import { DynamoDB } from 'aws-sdk';
import { Task, TaskStatus } from '@mindburn/shared';
import { createLogger } from '@mindburn/shared';
import { EventBridge } from 'aws-sdk';
import { SNS } from 'aws-sdk';

const logger = createLogger('TaskExpirationHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();
const sns = new SNS();

export async function handleExpiredTasks(): Promise<void> {
  const now = new Date().toISOString();
  
  // Query for tasks that have passed their deadline
  const { Items: expiredTasks = [] } = await dynamodb.query({
    TableName: process.env.TASKS_TABLE!,
    IndexName: 'StatusDeadlineIndex',
    KeyConditionExpression: '#status = :status AND deadline < :now',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': TaskStatus.IN_PROGRESS,
      ':now': now
    }
  }).promise();

  logger.info('Found expired tasks', {
    count: expiredTasks.length
  });

  // Process each expired task
  for (const task of expiredTasks) {
    try {
      await processExpiredTask(task as Task);
    } catch (error) {
      logger.error('Error processing expired task', {
        taskId: task.taskId,
        error
      });
    }
  }
}

async function processExpiredTask(task: Task): Promise<void> {
  const now = new Date().toISOString();
  
  // Update task status atomically
  try {
    await dynamodb.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: task.taskId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, expiredAt = :expiredAt',
      ConditionExpression: '#status = :currentStatus',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.EXPIRED,
        ':updatedAt': now,
        ':expiredAt': now,
        ':currentStatus': TaskStatus.IN_PROGRESS
      }
    }).promise();

    // Notify worker via SNS
    if (task.assignedTo) {
      await sns.publish({
        TopicArn: process.env.WORKER_NOTIFICATIONS_TOPIC!,
        Message: JSON.stringify({
          type: 'TASK_EXPIRED',
          taskId: task.taskId,
          workerId: task.assignedTo,
          timestamp: now
        })
      }).promise();
    }

    // Publish expiration event
    await eventBridge.putEvents({
      Entries: [{
        Source: 'mindburn.task-management',
        DetailType: 'TaskExpired',
        Detail: JSON.stringify({
          taskId: task.taskId,
          workerId: task.assignedTo,
          timestamp: now
        })
      }]
    }).promise();

    logger.info('Task expired', {
      taskId: task.taskId,
      workerId: task.assignedTo
    });

  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      logger.warn('Concurrent update detected for expired task', {
        taskId: task.taskId
      });
      return;
    }
    throw error;
  }
} 