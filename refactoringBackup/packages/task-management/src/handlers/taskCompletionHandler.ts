import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, StepFunctions } from 'aws-sdk';
import { createLogger, createEnvironmentTransformer } from '@mindburn/shared';
import { Task, TaskStatus, TaskSubmission } from '../types';

const logger = createLogger('TaskCompletionHandler');
const config = createEnvironmentTransformer(process.env);

const dynamoDB = new DynamoDB.DocumentClient();
const stepFunctions = new StepFunctions();

const TASKS_TABLE = config.get('TASKS_TABLE');
const SUBMISSIONS_TABLE = config.get('SUBMISSIONS_TABLE');
const WORKERS_TABLE = config.get('WORKERS_TABLE');
const CONSOLIDATION_WORKFLOW_ARN = config.get('CONSOLIDATION_WORKFLOW_ARN');

interface TaskCompletionBody {
  workerId: string;
  result: unknown;
  timeSpentSeconds: number;
}

const checkDuplicateSubmission = async (taskId: string, workerId: string): Promise<boolean> => {
  const { Items = [] } = await dynamoDB.query({
    TableName: SUBMISSIONS_TABLE,
    KeyConditionExpression: 'taskId = :taskId',
    FilterExpression: 'workerId = :workerId',
    ExpressionAttributeValues: {
      ':taskId': taskId,
      ':workerId': workerId
    }
  }).promise();
  
  return Items.length > 0;
};

const validateSubmission = (task: Task, workerId: string): void => {
  if (!task.assignedWorkers?.includes(workerId)) {
    throw new Error('Worker not assigned to this task');
  }

  if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
    throw new Error(`Task already ${task.status.toLowerCase()}`);
  }

  if (task.expiresAt < Date.now()) {
    throw new Error('Task has expired');
  }
};

const processSubmissionTransaction = async (
  task: Task,
  submission: TaskSubmission,
  completedVerifications: number,
  newStatus: TaskStatus
): Promise<void> => {
  const now = Date.now();
  
  const transactionItems = [
    // Store submission
    {
      Put: {
        TableName: SUBMISSIONS_TABLE,
        Item: submission,
        ConditionExpression: 'attribute_not_exists(taskId) AND attribute_not_exists(workerId)'
      }
    },
    // Update task status
    {
      Update: {
        TableName: TASKS_TABLE,
        Key: { taskId: task.taskId },
        UpdateExpression: 'SET completedVerifications = :completed, status = :status, updatedAt = :now',
        ExpressionAttributeValues: {
          ':completed': completedVerifications,
          ':status': newStatus,
          ':now': now
        }
      }
    },
    // Update worker stats
    {
      Update: {
        TableName: WORKERS_TABLE,
        Key: { workerId: submission.workerId },
        UpdateExpression: 'SET activeTaskCount = activeTaskCount - :dec, completedTaskCount = completedTaskCount + :inc',
        ExpressionAttributeValues: {
          ':dec': 1,
          ':inc': 1
        }
      }
    }
  ];

  await dynamoDB.transactWrite({ TransactItems: transactionItems }).promise();
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const taskId = event.pathParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task ID is required' })
      };
    }

    let body: TaskCompletionBody;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { workerId, result, timeSpentSeconds } = body;

    if (!workerId || timeSpentSeconds === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Worker ID and timeSpentSeconds are required' })
      };
    }

    // Get task details
    const { Item: task } = await dynamoDB.get({
      TableName: TASKS_TABLE,
      Key: { taskId }
    }).promise();

    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Task not found: ${taskId}` })
      };
    }

    try {
      // Validate submission
      validateSubmission(task as Task, workerId);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: e.message })
      };
    }

    // Check for duplicate submission
    const isDuplicate = await checkDuplicateSubmission(taskId, workerId);
    if (isDuplicate) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Duplicate submission not allowed' })
      };
    }

    const submission: TaskSubmission = {
      taskId,
      workerId,
      result,
      submittedAt: Date.now(),
      timeSpentSeconds
    };

    // Calculate new task status
    const completedVerifications = (task.completedVerifications || 0) + 1;
    const newStatus = completedVerifications >= task.requirements.verificationThreshold
      ? TaskStatus.COMPLETED
      : TaskStatus.IN_PROGRESS;

    // Process submission with transaction
    await processSubmissionTransaction(task as Task, submission, completedVerifications, newStatus);

    // If task is completed, trigger result consolidation
    if (newStatus === TaskStatus.COMPLETED) {
      await stepFunctions.startExecution({
        stateMachineArn: CONSOLIDATION_WORKFLOW_ARN,
        input: JSON.stringify({
          taskId,
          action: 'CONSOLIDATE_RESULTS'
        })
      }).promise();

      logger.info('Started result consolidation workflow', {
        taskId,
        completedVerifications
      });
    }

    logger.info('Task submission processed successfully', {
      taskId,
      workerId,
      timeSpentSeconds
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        taskId,
        status: newStatus
      })
    };

  } catch (error) {
    logger.error('Failed to process task submission', { error });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 