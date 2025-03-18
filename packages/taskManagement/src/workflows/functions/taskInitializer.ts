import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('TaskInitializer');
const dynamodb = new DynamoDB.DocumentClient();

interface TaskInitializerInput {
  taskId: string;
  verificationRequirements: {
    timeoutMinutes: number;
  };
}

interface TaskInitializerOutput {
  taskId: string;
  status: TaskStatus;
  verificationRequirements: {
    timeoutMinutes: number;
  };
  expiresAt?: string;
  error?: string;
}

export const handler = async (event: TaskInitializerInput): Promise<TaskInitializerOutput> => {
  try {
    logger.info('Initializing task', { taskId: event.taskId });

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

    // Calculate expiration time
    const expirationTime = new Date();
    expirationTime.setMinutes(
      expirationTime.getMinutes() + event.verificationRequirements.timeoutMinutes
    );
    const expiresAt = expirationTime.toISOString();

    // Initialize task workflow context
    await dynamodb
      .update({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId: event.taskId },
        UpdateExpression: 'SET #status = :status, expiresAt = :expiresAt, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': TaskStatus.VERIFICATION_PENDING,
          ':expiresAt': expiresAt,
          ':now': new Date().toISOString(),
        },
      })
      .promise();

    logger.info('Task initialized successfully', {
      taskId: event.taskId,
      status: TaskStatus.VERIFICATION_PENDING,
      expiresAt,
    });

    return {
      taskId: event.taskId,
      status: TaskStatus.VERIFICATION_PENDING,
      verificationRequirements: event.verificationRequirements,
      expiresAt,
    };
  } catch (error) {
    logger.error('Failed to initialize task', { error, taskId: event.taskId });

    // Update task status to failed
    await dynamodb
      .update({
        TableName: process.env.TASKS_TABLE!,
        Key: { taskId: event.taskId },
        UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': TaskStatus.FAILED,
          ':reason': error instanceof Error ? error.message : 'Unknown error during initialization',
          ':now': new Date().toISOString(),
        },
      })
      .promise();

    throw error;
  }
};
