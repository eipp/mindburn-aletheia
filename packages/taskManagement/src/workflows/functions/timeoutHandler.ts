import { DynamoDB, EventBridge } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('TimeoutHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();

interface TimeoutHandlerInput {
  taskId: string;
  verificationRequirements: {
    timeoutMinutes: number;
  };
  expiresAt?: string;
}

interface TimeoutHandlerOutput {
  taskId: string;
  status: TaskStatus;
  timeoutDetails: {
    timeoutAt: string;
    reason: string;
    originalExpiresAt?: string;
    timeoutType: 'ACCEPTANCE' | 'VERIFICATION' | 'SYSTEM';
  };
}

export const handler = async (event: TimeoutHandlerInput): Promise<TimeoutHandlerOutput> => {
  try {
    logger.info('Handling task timeout', { taskId: event.taskId });

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

    // Determine timeout type
    const timeoutType = determineTimeoutType(task);
    const timeoutDetails = {
      timeoutAt: new Date().toISOString(),
      reason: getTimeoutReason(timeoutType),
      originalExpiresAt: event.expiresAt,
      timeoutType,
    };

    // Update task as timed out
    await updateTaskAsTimedOut(task.taskId, timeoutDetails);

    // Emit timeout event
    await emitTimeoutEvent(task.taskId, timeoutDetails);

    // Handle any cleanup needed
    await handleTimeoutCleanup(task, timeoutType);

    return {
      taskId: task.taskId,
      status: TaskStatus.FAILED,
      timeoutDetails,
    };
  } catch (error) {
    logger.error('Failed to handle timeout', { error, taskId: event.taskId });
    throw error;
  }
};

function determineTimeoutType(task: Task): TimeoutHandlerOutput['timeoutDetails']['timeoutType'] {
  if (task.status === TaskStatus.PENDING_ACCEPTANCE) {
    return 'ACCEPTANCE';
  }
  if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.VERIFICATION_PENDING) {
    return 'VERIFICATION';
  }
  return 'SYSTEM';
}

function getTimeoutReason(
  timeoutType: TimeoutHandlerOutput['timeoutDetails']['timeoutType']
): string {
  switch (timeoutType) {
    case 'ACCEPTANCE':
      return 'No workers accepted the task within the specified time';
    case 'VERIFICATION':
      return 'Task verification was not completed within the specified time';
    case 'SYSTEM':
      return 'Task timed out due to system constraints';
    default:
      return 'Task timed out';
  }
}

async function updateTaskAsTimedOut(
  taskId: string,
  timeoutDetails: TimeoutHandlerOutput['timeoutDetails']
): Promise<void> {
  await dynamodb
    .update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: `
      SET #status = :status,
          timeoutDetails = :details,
          statusReason = :reason,
          updatedAt = :now
    `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.FAILED,
        ':details': timeoutDetails,
        ':reason': timeoutDetails.reason,
        ':now': new Date().toISOString(),
      },
    })
    .promise();
}

async function emitTimeoutEvent(
  taskId: string,
  timeoutDetails: TimeoutHandlerOutput['timeoutDetails']
): Promise<void> {
  await eventBridge
    .putEvents({
      Entries: [
        {
          Source: 'aletheia.task-management',
          DetailType: 'TaskTimeout',
          Detail: JSON.stringify({
            taskId,
            timeoutDetails,
            timestamp: new Date().toISOString(),
          }),
          EventBusName: process.env.EVENT_BUS_NAME,
        },
      ],
    })
    .promise();
}

async function handleTimeoutCleanup(
  task: Task,
  timeoutType: TimeoutHandlerOutput['timeoutDetails']['timeoutType']
): Promise<void> {
  switch (timeoutType) {
    case 'ACCEPTANCE':
      // Remove task from eligible workers' queues
      if (task.eligibleWorkers?.length) {
        // Implementation needed
      }
      break;

    case 'VERIFICATION':
      // Cancel any pending verifications
      if (task.assignedWorkers?.length) {
        // Implementation needed
      }
      break;

    case 'SYSTEM':
      // Handle any system-level cleanup
      break;
  }
}
