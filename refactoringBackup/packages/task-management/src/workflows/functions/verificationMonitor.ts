import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('VerificationMonitor');
const dynamodb = new DynamoDB.DocumentClient();

interface VerificationMonitorInput {
  taskId: string;
  verificationRequirements: {
    verificationThreshold: number;
    timeoutMinutes: number;
  };
  expiresAt?: string;
}

interface VerificationMonitorOutput {
  taskId: string;
  status: TaskStatus;
  completedVerifications: number;
  assignedWorkers: string[];
  error?: string;
}

export const handler = async (event: VerificationMonitorInput): Promise<VerificationMonitorOutput> => {
  try {
    logger.info('Monitoring verification progress', { taskId: event.taskId });

    // Get task from DynamoDB
    const result = await dynamodb.get({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: event.taskId }
    }).promise();

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
        error: 'Task expired'
      };
    }

    // Check verification progress
    const completedVerifications = task.completedVerifications || 0;
    const threshold = event.verificationRequirements.verificationThreshold;

    // If we have enough verifications, mark as complete
    if (completedVerifications >= threshold) {
      await updateTaskStatus(task.taskId, TaskStatus.VERIFICATION_COMPLETE);
      return {
        taskId: task.taskId,
        status: TaskStatus.VERIFICATION_COMPLETE,
        completedVerifications,
        assignedWorkers: task.assignedWorkers || []
      };
    }

    // Check if we have enough active workers
    const assignedWorkers = task.assignedWorkers || [];
    const activeWorkerCount = assignedWorkers.length;

    // If we don't have enough active workers and task is not new, mark as failed
    if (activeWorkerCount < threshold && task.status !== TaskStatus.CREATED) {
      await handleInsufficientWorkers(task);
      return {
        taskId: task.taskId,
        status: TaskStatus.FAILED,
        completedVerifications,
        assignedWorkers,
        error: 'Insufficient active workers'
      };
    }

    // Return current status
    return {
      taskId: task.taskId,
      status: task.status,
      completedVerifications,
      assignedWorkers
    };

  } catch (error) {
    logger.error('Failed to monitor verification', { error, taskId: event.taskId });
    throw error;
  }
};

async function handleExpiredTask(task: Task): Promise<void> {
  await dynamodb.update({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId: task.taskId },
    UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': TaskStatus.FAILED,
      ':reason': 'Task expired',
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function handleInsufficientWorkers(task: Task): Promise<void> {
  await dynamodb.update({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId: task.taskId },
    UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': TaskStatus.FAILED,
      ':reason': 'Insufficient active workers',
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  await dynamodb.update({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':now': new Date().toISOString()
    }
  }).promise();
} 