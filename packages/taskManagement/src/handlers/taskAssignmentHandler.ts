import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { createLogger, ValidationError, NotFoundError, ConflictError } from '@mindburn/shared';
import { Task, TaskStatus, WorkerProfile, TaskDistributionStrategy } from '../types';

const logger = createLogger('taskAssignmentHandler');
const dynamo = DynamoDBDocument.from(new DynamoDB({}));
const eventBridge = new EventBridge({});

const TASKS_TABLE = process.env.TASKS_TABLE!;
const WORKERS_TABLE = process.env.WORKERS_TABLE!;
const MAX_ASSIGNMENTS_PER_WORKER = 5;

interface AssignmentRequest {
  taskId: string;
  workerId: string;
  action: 'accept' | 'reject';
}

const findEligibleWorkers = async (task: Task): Promise<WorkerProfile[]> => {
  const { minWorkerLevel, requiredSkills } = task.requirements;

  // Query available workers with sufficient level using AvailableWorkersIndex
  const { Items: availableWorkers = [] } = await dynamo.query({
    TableName: WORKERS_TABLE,
    IndexName: 'AvailableWorkersIndex',
    KeyConditionExpression: 'availabilityStatus = :status AND #level >= :minLevel',
    ExpressionAttributeNames: {
      '#level': 'level',
    },
    ExpressionAttributeValues: {
      ':status': 'AVAILABLE',
      ':minLevel': minWorkerLevel,
    },
  });

  // Filter workers by task count using WorkerLoadIndex
  const { Items: eligibleWorkers = [] } = await dynamo.query({
    TableName: WORKERS_TABLE,
    IndexName: 'WorkerLoadIndex',
    KeyConditionExpression: 'availabilityStatus = :status AND activeTaskCount < :maxTasks',
    ExpressionAttributeValues: {
      ':status': 'AVAILABLE',
      ':maxTasks': MAX_ASSIGNMENTS_PER_WORKER,
    },
  });

  // Create a set of eligible worker IDs
  const eligibleWorkerIds = new Set(eligibleWorkers.map(w => w.workerId));

  // Filter available workers by task count and required skills
  return (availableWorkers as WorkerProfile[]).filter(
    worker =>
      eligibleWorkerIds.has(worker.workerId) &&
      requiredSkills.every(skill => worker.skills.includes(skill))
  );
};

const assignTaskToWorkers = async (
  task: Task,
  eligibleWorkers: WorkerProfile[]
): Promise<string[]> => {
  const assignedWorkers: string[] = [];

  switch (task.distributionStrategy) {
    case TaskDistributionStrategy.BROADCAST:
      // Assign to all eligible workers
      assignedWorkers.push(...eligibleWorkers.map(w => w.workerId));
      break;

    case TaskDistributionStrategy.TARGETED:
      // Select best matching workers based on reputation and success rate
      const sortedWorkers = [...eligibleWorkers].sort(
        (a, b) => b.reputation * b.successRate - a.reputation * a.successRate
      );
      assignedWorkers.push(
        ...sortedWorkers.slice(0, task.requirements.verificationThreshold * 2).map(w => w.workerId)
      );
      break;

    case TaskDistributionStrategy.AUCTION:
      // Implement auction-based assignment logic
      // For now, assign to top workers as placeholder
      const topWorkers = [...eligibleWorkers]
        .sort((a, b) => b.reputation - a.reputation)
        .slice(0, task.requirements.verificationThreshold);
      assignedWorkers.push(...topWorkers.map(w => w.workerId));
      break;
  }

  if (assignedWorkers.length > 0) {
    // Update task with assigned workers
    await dynamo.update({
      TableName: TASKS_TABLE,
      Key: { taskId: task.taskId },
      UpdateExpression: 'SET assignedWorkers = :workers, status = :status, updatedAt = :now',
      ExpressionAttributeValues: {
        ':workers': assignedWorkers,
        ':status': TaskStatus.PENDING,
        ':now': Date.now(),
      },
    });

    // Update worker task counts
    await Promise.all(
      assignedWorkers.map(workerId =>
        dynamo.update({
          TableName: WORKERS_TABLE,
          Key: { workerId },
          UpdateExpression: 'SET activeTaskCount = activeTaskCount + :inc',
          ExpressionAttributeValues: { ':inc': 1 },
        })
      )
    );
  }

  return assignedWorkers;
};

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const request: AssignmentRequest = JSON.parse(event.body || '{}');
    logger.info('Processing task assignment', {
      taskId: request.taskId,
      workerId: request.workerId,
      action: request.action,
    });

    // Validate request
    if (!request.taskId || !request.workerId || !request.action) {
      throw new ValidationError('Missing required fields in request');
    }

    if (!['accept', 'reject'].includes(request.action)) {
      throw new ValidationError('Invalid action');
    }

    // Get task from DynamoDB
    const task = await dynamo.get({
      TableName: TASKS_TABLE,
      Key: { taskId: request.taskId },
    });

    if (!task.Item) {
      throw new NotFoundError('Task not found');
    }

    // Check if task is available for assignment
    if (task.Item.status !== 'verification_pending') {
      throw new ConflictError('Task is not available for assignment');
    }

    // Get worker from DynamoDB
    const worker = await dynamo.get({
      TableName: WORKERS_TABLE,
      Key: { workerId: request.workerId },
    });

    if (!worker.Item) {
      throw new NotFoundError('Worker not found');
    }

    if (request.action === 'accept') {
      // Check if worker is already assigned
      if (task.Item.assignedWorkers?.includes(request.workerId)) {
        throw new ConflictError('Worker already assigned to this task');
      }

      // Check worker's active task count
      if (worker.Item.activeTaskCount >= worker.Item.maxConcurrentTasks) {
        throw new ConflictError('Worker has reached maximum concurrent tasks');
      }

      // Update task with worker assignment
      await dynamo.update({
        TableName: TASKS_TABLE,
        Key: { taskId: request.taskId },
        UpdateExpression:
          'SET assignedWorkers = list_append(if_not_exists(assignedWorkers, :empty), :worker), ' +
          'assignmentCount = if_not_exists(assignmentCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':worker': [request.workerId],
          ':empty': [],
          ':zero': 0,
          ':one': 1,
        },
        ConditionExpression: 'attribute_exists(taskId)',
      });

      // Update worker's active task count
      await dynamo.update({
        TableName: WORKERS_TABLE,
        Key: { workerId: request.workerId },
        UpdateExpression:
          'SET activeTaskCount = if_not_exists(activeTaskCount, :zero) + :one, ' +
          'activeTasks = list_append(if_not_exists(activeTasks, :empty), :task)',
        ExpressionAttributeValues: {
          ':task': [request.taskId],
          ':empty': [],
          ':zero': 0,
          ':one': 1,
        },
      });
    } else {
      // Update task rejection count
      await dynamo.update({
        TableName: TASKS_TABLE,
        Key: { taskId: request.taskId },
        UpdateExpression: 'SET rejectionCount = if_not_exists(rejectionCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
      });
    }

    // Emit assignment event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: 'task-management',
          DetailType: `TaskAssignment${request.action === 'accept' ? 'Accepted' : 'Rejected'}`,
          Detail: JSON.stringify({
            taskId: request.taskId,
            workerId: request.workerId,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    logger.info('Task assignment processed successfully', {
      taskId: request.taskId,
      workerId: request.workerId,
      action: request.action,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:
          request.action === 'accept' ? 'Task assigned successfully' : 'Task rejected successfully',
      }),
    };
  } catch (error) {
    logger.error('Error processing task assignment', { error });

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

    if (error instanceof ConflictError) {
      return {
        statusCode: 409,
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
