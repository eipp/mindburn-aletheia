import { DynamoDB, EventBridge } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('TaskCompleter');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();

interface TaskCompleterInput {
  taskId: string;
  consolidatedResult: {
    result: any;
    confidence: number;
    verifierCount: number;
    timeSpentAvg: number;
    metadata: Record<string, any>;
  };
}

interface TaskCompleterOutput {
  taskId: string;
  status: TaskStatus;
  completionDetails: {
    completedAt: string;
    result: any;
    confidence: number;
    verifierCount: number;
    timeSpentAvg: number;
    metadata: Record<string, any>;
  };
}

export const handler = async (event: TaskCompleterInput): Promise<TaskCompleterOutput> => {
  try {
    logger.info('Completing task', { taskId: event.taskId });

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

    const completionDetails = {
      completedAt: new Date().toISOString(),
      ...event.consolidatedResult,
    };

    // Update task as completed
    await updateTaskAsCompleted(task.taskId, completionDetails);

    // Emit completion event
    await emitCompletionEvent(task.taskId, completionDetails);

    return {
      taskId: task.taskId,
      status: TaskStatus.COMPLETED,
      completionDetails,
    };
  } catch (error) {
    logger.error('Failed to complete task', { error, taskId: event.taskId });
    throw error;
  }
};

async function updateTaskAsCompleted(
  taskId: string,
  completionDetails: TaskCompleterOutput['completionDetails']
): Promise<void> {
  await dynamodb
    .update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: `
      SET #status = :status,
          completionDetails = :details,
          updatedAt = :now
    `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.COMPLETED,
        ':details': completionDetails,
        ':now': new Date().toISOString(),
      },
    })
    .promise();
}

async function emitCompletionEvent(
  taskId: string,
  completionDetails: TaskCompleterOutput['completionDetails']
): Promise<void> {
  await eventBridge
    .putEvents({
      Entries: [
        {
          Source: 'aletheia.task-management',
          DetailType: 'TaskCompleted',
          Detail: JSON.stringify({
            taskId,
            completionDetails,
            timestamp: new Date().toISOString(),
          }),
          EventBusName: process.env.EVENT_BUS_NAME,
        },
      ],
    })
    .promise();
}
