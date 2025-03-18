import { DynamoDB } from 'aws-sdk';
import { Task, TaskStatus } from '@mindburn/shared';
import { createLogger } from '@mindburn/shared';
import { EventBridge } from 'aws-sdk';

const logger = createLogger('TaskStatusHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();

const STATUS_TRANSITIONS = {
  [TaskStatus.PENDING]: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
  [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.EXPIRED, TaskStatus.CANCELLED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.EXPIRED]: [],
  [TaskStatus.CANCELLED]: []
} as const;

export async function updateTaskStatus(
  taskId: string, 
  newStatus: TaskStatus, 
  workerId?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Get current task state
  const { Item: task } = await dynamodb.get({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId }
  }).promise();

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const currentStatus = task.status as TaskStatus;
  
  // Validate transition
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }

  // Prepare update expression
  const updateExpr = [
    'SET #status = :status',
    'updatedAt = :updatedAt'
  ];
  const exprAttrNames: Record<string, string> = { '#status': 'status' };
  const exprAttrValues: Record<string, any> = {
    ':status': newStatus,
    ':updatedAt': now
  };

  // Add worker assignment if provided
  if (workerId) {
    updateExpr.push('assignedTo = :workerId');
    exprAttrValues[':workerId'] = workerId;
  }

  // Add completion time for completed tasks
  if (newStatus === TaskStatus.COMPLETED) {
    updateExpr.push('completedAt = :completedAt');
    exprAttrValues[':completedAt'] = now;
  }

  // Atomic update with condition
  try {
    await dynamodb.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: updateExpr.join(', '),
      ConditionExpression: '#status = :currentStatus',
      ExpressionAttributeNames: {
        ...exprAttrNames,
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ...exprAttrValues,
        ':currentStatus': currentStatus
      }
    }).promise();

    // Publish status change event
    await eventBridge.putEvents({
      Entries: [{
        Source: 'mindburn.task-management',
        DetailType: 'TaskStatusChanged',
        Detail: JSON.stringify({
          taskId,
          oldStatus: currentStatus,
          newStatus,
          workerId,
          timestamp: now
        })
      }]
    }).promise();

    logger.info('Task status updated', {
      taskId,
      oldStatus: currentStatus,
      newStatus,
      workerId
    });

  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error(`Concurrent update detected for task ${taskId}`);
    }
    throw error;
  }
}

function isValidTransition(currentStatus: TaskStatus, newStatus: TaskStatus): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(newStatus);
} 