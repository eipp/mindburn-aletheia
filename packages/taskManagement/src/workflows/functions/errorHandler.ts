import { DynamoDB, EventBridge } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('ErrorHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();

interface ErrorHandlerInput {
  taskId: string;
  error: {
    Error: string;
    Cause?: string;
  };
  executionArn: string;
  previousState: string;
}

interface ErrorHandlerOutput {
  taskId: string;
  status: TaskStatus;
  error: {
    message: string;
    cause?: string;
    state: string;
    executionArn: string;
    timestamp: string;
  };
}

export const handler = async (event: ErrorHandlerInput): Promise<ErrorHandlerOutput> => {
  try {
    logger.error('Handling workflow error', {
      taskId: event.taskId,
      error: event.error,
      previousState: event.previousState,
    });

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

    // Create error record
    const errorRecord = {
      message: event.error.Error,
      cause: event.error.Cause,
      state: event.previousState,
      executionArn: event.executionArn,
      timestamp: new Date().toISOString(),
    };

    // Update task with error information
    await updateTaskWithError(task.taskId, errorRecord);

    // Emit error event
    await emitErrorEvent(task.taskId, errorRecord);

    // Attempt recovery if possible
    const recoveryAttempted = await attemptRecovery(task, errorRecord);

    return {
      taskId: task.taskId,
      status: recoveryAttempted ? TaskStatus.IN_PROGRESS : TaskStatus.FAILED,
      error: errorRecord,
    };
  } catch (error) {
    logger.error('Error handler failed', { error, taskId: event.taskId });
    throw error;
  }
};

async function updateTaskWithError(
  taskId: string,
  error: ErrorHandlerOutput['error']
): Promise<void> {
  await dynamodb
    .update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: `
      SET #status = :status,
          lastError = :error,
          statusReason = :reason,
          updatedAt = :now
    `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.FAILED,
        ':error': error,
        ':reason': error.message,
        ':now': new Date().toISOString(),
      },
    })
    .promise();
}

async function emitErrorEvent(taskId: string, error: ErrorHandlerOutput['error']): Promise<void> {
  await eventBridge
    .putEvents({
      Entries: [
        {
          Source: 'aletheia.task-management',
          DetailType: 'TaskError',
          Detail: JSON.stringify({
            taskId,
            error,
            timestamp: new Date().toISOString(),
          }),
          EventBusName: process.env.EVENT_BUS_NAME,
        },
      ],
    })
    .promise();
}

async function attemptRecovery(task: Task, error: ErrorHandlerOutput['error']): Promise<boolean> {
  // Implement recovery strategies based on error type and task state
  const recoveryStrategies: Record<string, () => Promise<boolean>> = {
    // Add recovery strategies here
    NoEligibleWorkersError: async () => {
      // Retry worker matching with relaxed criteria
      return false; // Not implemented yet
    },
    TimeoutError: async () => {
      // Extend timeout if within limits
      return false; // Not implemented yet
    },
    VerificationError: async () => {
      // Retry verification with different workers
      return false; // Not implemented yet
    },
  };

  // Extract error type from error message
  const errorType = error.message.split(':')[0];
  const recoveryStrategy = recoveryStrategies[errorType];

  if (recoveryStrategy) {
    try {
      return await recoveryStrategy();
    } catch (recoveryError) {
      logger.error('Recovery attempt failed', {
        taskId: task.taskId,
        error: recoveryError,
        originalError: error,
      });
    }
  }

  return false;
}
