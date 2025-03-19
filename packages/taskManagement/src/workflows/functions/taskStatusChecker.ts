import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('TaskStatusChecker');
const dynamodb = new DynamoDB.DocumentClient();

interface TaskStatusInput {
  taskId: string;
  verificationRequirements: {
    timeoutMinutes: number;
  };
  expiresAt?: string;
}

interface TaskStatusOutput {
  taskId: string;
  status: TaskStatus;
  completedVerifications: number;
  assignedWorkers: string[];
  error?: string;
}

export const handler = async (event: TaskStatusInput): Promise<TaskStatusOutput> => {
  try {
    logger.info('Checking task status', { taskId: event.taskId });

    // Get task from DynamoDB
    const result = await dynamodb
      .get({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId: event.taskId },
      })
      .promise();

    const task = result.Item as Task;
    if (!task) {
      throw new Error(`Task not found: ${event.taskId}`);
    }

    // Check if task has expired
    if (event.expiresAt && new Date(event.expiresAt) < new Date()) {
      await handleExpiredTask(task);
      return {
        taskId: task.taskId,
        status: TaskStatus.FAILED,
        completedVerifications: task.completedVerifications || 0,
        assignedWorkers: task.assignedWorkers || [],
        error: 'Task expired',
      };
    }

    // Check if task has required number of verifications
    const hasRequiredVerifications =
      task.completedVerifications !== undefined &&
      task.completedVerifications >= task.verificationRequirements.verificationThreshold;

    if (hasRequiredVerifications) {
      await updateTaskStatus(task.taskId, TaskStatus.VERIFICATION_COMPLETE);
      return {
        taskId: task.taskId,
        status: TaskStatus.VERIFICATION_COMPLETE,
        completedVerifications: task.completedVerifications!,
        assignedWorkers: task.assignedWorkers || [],
      };
    }

    // Return current status
    return {
      taskId: task.taskId,
      status: task.status,
      completedVerifications: task.completedVerifications || 0,
      assignedWorkers: task.assignedWorkers || [],
    };
  } catch (error) {
    logger.error('Failed to check task status', { error, taskId: event.taskId });
    throw error;
  }
};

async function handleExpiredTask(task: Task): Promise<void> {
  await dynamodb
    .update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: task.taskId },
      UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.FAILED,
        ':reason': 'Task expired',
        ':now': new Date().toISOString(),
      },
    })
    .promise();
}

async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  await dynamodb
    .update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    })
    .promise();
}
