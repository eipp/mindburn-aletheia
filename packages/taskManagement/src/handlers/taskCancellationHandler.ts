import { DynamoDB } from 'aws-sdk';
import { Task, TaskStatus } from '@mindburn/shared';
import { createLogger } from '@mindburn/shared';
import { EventBridge } from 'aws-sdk';
import { SNS } from 'aws-sdk';

const logger = createLogger('TaskCancellationHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();
const sns = new SNS();

export async function cancelTask(taskId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Get current task state
  const { Item: task } = await dynamodb.get({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId }
  }).promise();

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const currentTask = task as Task;
  
  // Validate if task can be cancelled
  if (![TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS].includes(currentTask.status)) {
    throw new Error(`Cannot cancel task in ${currentTask.status} status`);
  }

  try {
    // Update task status atomically
    await dynamodb.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, cancellationReason = :reason, cancelledAt = :cancelledAt',
      ConditionExpression: '#status IN (:validStatuses)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.CANCELLED,
        ':updatedAt': now,
        ':reason': reason,
        ':cancelledAt': now,
        ':validStatuses': [TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]
      }
    }).promise();

    // Notify assigned worker if any
    if (currentTask.assignedTo) {
      await sns.publish({
        TopicArn: process.env.WORKER_NOTIFICATIONS_TOPIC!,
        Message: JSON.stringify({
          type: 'TASK_CANCELLED',
          taskId,
          workerId: currentTask.assignedTo,
          reason,
          timestamp: now
        })
      }).promise();
    }

    // Publish cancellation event
    await eventBridge.putEvents({
      Entries: [{
        Source: 'mindburn.task-management',
        DetailType: 'TaskCancelled',
        Detail: JSON.stringify({
          taskId,
          workerId: currentTask.assignedTo,
          reason,
          timestamp: now,
          refundRequired: currentTask.status !== TaskStatus.PENDING
        })
      }]
    }).promise();

    logger.info('Task cancelled', {
      taskId,
      workerId: currentTask.assignedTo,
      reason,
      previousStatus: currentTask.status
    });

  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error(`Task ${taskId} cannot be cancelled due to its current state`);
    }
    throw error;
  }
} 