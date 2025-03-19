import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { createLogger, ValidationError, NotFoundError } from '@mindburn/shared';

const logger = createLogger('taskSubmissionHandler');
const dynamo = DynamoDBDocument.from(new DynamoDB({}));
const eventBridge = new EventBridge({});

interface TaskSubmission {
  taskId: string;
  workerId: string;
  result: {
    answer: string;
    confidence: number;
    metadata: Record<string, any>;
  };
  timeSpentSeconds: number;
}

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const submission: TaskSubmission = JSON.parse(event.body || '{}');
    logger.info('Processing task submission', {
      taskId: submission.taskId,
      workerId: submission.workerId,
    });

    // Validate submission
    if (!submission.taskId || !submission.workerId || !submission.result) {
      throw new ValidationError('Missing required fields in submission');
    }

    // Get task from DynamoDB
    const task = await dynamo.get({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: submission.taskId },
    });

    if (!task.Item) {
      throw new NotFoundError('Task not found');
    }

    // Validate worker assignment
    if (task.Item.assignedWorkers?.indexOf(submission.workerId) === -1) {
      throw new ValidationError('Worker not assigned to this task');
    }

    // Update task with submission
    await dynamo.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: submission.taskId },
      UpdateExpression:
        'SET verifications = list_append(if_not_exists(verifications, :empty), :submission), ' +
        'submissionCount = if_not_exists(submissionCount, :zero) + :one',
      ExpressionAttributeValues: {
        ':submission': [
          {
            workerId: submission.workerId,
            result: submission.result,
            timeSpentSeconds: submission.timeSpentSeconds,
            submittedAt: new Date().toISOString(),
          },
        ],
        ':empty': [],
        ':zero': 0,
        ':one': 1,
      },
    });

    // Emit submission event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: 'task-management',
          DetailType: 'TaskSubmissionReceived',
          Detail: JSON.stringify({
            taskId: submission.taskId,
            workerId: submission.workerId,
            submissionTime: new Date().toISOString(),
          }),
        },
      ],
    });

    logger.info('Task submission processed successfully', { taskId: submission.taskId });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Submission accepted' }),
    };
  } catch (error) {
    logger.error('Error processing task submission', { error });

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (error instanceof NotFoundError) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
