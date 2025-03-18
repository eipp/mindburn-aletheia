import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { SQS } from 'aws-sdk';
import { EventBridge } from 'aws-sdk';
import { createLogger, Task, createEnvironmentTransformer } from '@mindburn/shared';
import { WorkerMatcher } from '../services/workerMatcher';
import { 
  DistributionResult, 
  TaskAssignmentResult, 
  TaskReclaimResult,
  TaskDistributorConfig 
} from '../types/distributor';

const logger = createLogger('TaskDistributor');
const config = createEnvironmentTransformer<TaskDistributorConfig>(process.env);

const dynamodb = new DynamoDB.DocumentClient();
const sqs = new SQS();
const eventBridge = new EventBridge();

const workerMatcher = new WorkerMatcher({ minMatchScore: config.minMatchScore });

export async function distributeTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { taskId } = JSON.parse(event.body || '{}');

    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task ID is required' })
      };
    }

    // Get task details from DynamoDB
    const task = await getTask(taskId);
    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' })
      };
    }

    // Check if task is already distributed
    if (task.status !== 'pending') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Task already distributed' })
      };
    }

    // Find eligible workers
    const matchCriteria = {
      taskType: task.verificationRequirements.type,
      requiredSkills: task.verificationRequirements.requiredSkills || [],
      minLevel: task.verificationRequirements.minVerifierLevel,
      languageCodes: task.verificationRequirements.languageCodes,
      urgency: task.verificationRequirements.urgency
    };

    const eligibleWorkers = await workerMatcher.findEligibleWorkers(task, matchCriteria);

    // Determine distribution strategy
    const strategy = determineDistributionStrategy(task, eligibleWorkers.length);

    // Send task to SQS for distribution
    const notificationsSent = await sendTaskToQueue(task, eligibleWorkers, strategy);

    // Update task status
    await updateTaskStatus(taskId, 'in_progress', eligibleWorkers.map(w => w.workerId));

    // Emit task distribution event
    await emitDistributionEvent(task, eligibleWorkers, strategy);

    const result: DistributionResult = {
      taskId,
      eligibleWorkers: eligibleWorkers.map(w => w.workerId),
      distributionStrategy: strategy,
      notificationsSent,
      executionId: Date.now().toString() // Replace with actual Step Function execution ID
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Error distributing task', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Distribution failed' })
    };
  }
}

export async function assignTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { taskId, workerId } = JSON.parse(event.body || '{}');

    if (!taskId || !workerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task ID and Worker ID are required' })
      };
    }

    const task = await getTask(taskId);
    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' })
      };
    }

    // Check worker eligibility
    const worker = await getWorker(workerId);
    if (!worker) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Worker not found' })
      };
    }

    // Verify worker is eligible for task
    const matchScore = workerMatcher.calculateMatchScore(worker, {
      taskType: task.verificationRequirements.type,
      requiredSkills: task.verificationRequirements.requiredSkills || [],
      minLevel: task.verificationRequirements.minVerifierLevel,
      urgency: task.verificationRequirements.urgency
    });

    if (matchScore < config.minMatchScore) {
      return {
        statusCode: 422,
        body: JSON.stringify({ error: 'Worker not eligible for task' })
      };
    }

    // Check if task is already assigned
    if (task.assignedVerifiers.includes(workerId)) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Task already assigned to worker' })
      };
    }

    // Calculate deadline based on urgency
    const deadline = calculateDeadline(task.verificationRequirements.urgency);

    // Update task and worker status
    await Promise.all([
      updateTaskAssignment(taskId, workerId),
      updateWorkerStatus(workerId, 'busy')
    ]);

    const result: TaskAssignmentResult = {
      taskId,
      workerId,
      assignedAt: new Date().toISOString(),
      deadline,
      success: true
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Error assigning task', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Assignment failed' })
    };
  }
}

export async function reclaimTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { taskId, workerId, reason } = JSON.parse(event.body || '{}');

    if (!taskId || !workerId || !reason) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task ID, Worker ID, and reason are required' })
      };
    }

    const task = await getTask(taskId);
    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' })
      };
    }

    if (!task.assignedVerifiers.includes(workerId)) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Task not assigned to worker' })
      };
    }

    // Update task and worker status
    await Promise.all([
      removeTaskAssignment(taskId, workerId),
      updateWorkerStatus(workerId, 'active')
    ]);

    // Emit task reclaim event
    await emitReclaimEvent(taskId, workerId, reason);

    const result: TaskReclaimResult = {
      taskId,
      workerId,
      reclaimedAt: new Date().toISOString(),
      success: true
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Error reclaiming task', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Reclaim failed' })
    };
  }
}

// Helper functions
async function getTask(taskId: string): Promise<Task | null> {
  const result = await dynamodb.get({
    TableName: 'Tasks',
    Key: { taskId }
  }).promise();
  
  return result.Item as Task || null;
}

async function getWorker(workerId: string): Promise<any> {
  const result = await dynamodb.get({
    TableName: 'Workers',
    Key: { workerId }
  }).promise();
  
  return result.Item || null;
}

function determineDistributionStrategy(task: Task, eligibleWorkerCount: number): 'broadcast' | 'targeted' | 'auction' {
  if (task.verificationRequirements.urgency === 'critical') {
    return 'broadcast';
  }
  if (eligibleWorkerCount <= 5) {
    return 'targeted';
  }
  return 'auction';
}

async function sendTaskToQueue(task: Task, workers: any[], strategy: string): Promise<number> {
  const message = {
    taskId: task.taskId,
    workers: workers.map(w => w.workerId),
    strategy,
    timestamp: Date.now()
  };

  await sqs.sendMessage({
    QueueUrl: process.env.TASK_DISTRIBUTION_QUEUE_URL!,
    MessageBody: JSON.stringify(message)
  }).promise();

  return workers.length;
}

async function updateTaskStatus(taskId: string, status: string, eligibleWorkers: string[]): Promise<void> {
  await dynamodb.update({
    TableName: 'Tasks',
    Key: { taskId },
    UpdateExpression: 'SET #status = :status, eligibleWorkers = :workers, updatedAt = :now',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':workers': eligibleWorkers,
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function emitDistributionEvent(task: Task, workers: any[], strategy: string): Promise<void> {
  await eventBridge.putEvents({
    Entries: [{
      Source: 'aletheia.task-distributor',
      DetailType: 'TaskDistributed',
      Detail: JSON.stringify({
        taskId: task.taskId,
        eligibleWorkerCount: workers.length,
        strategy,
        timestamp: Date.now()
      }),
      EventBusName: process.env.EVENT_BUS_NAME
    }]
  }).promise();
}

function calculateDeadline(urgency: string): string {
  const baseMinutes = config.taskTimeoutMinutes;
  const multiplier = config.urgencyMultipliers[urgency as keyof typeof config.urgencyMultipliers];
  const deadline = new Date();
  deadline.setMinutes(deadline.getMinutes() + (baseMinutes * multiplier));
  return deadline.toISOString();
}

// Additional helper functions for task assignment and worker status updates
async function updateTaskAssignment(taskId: string, workerId: string): Promise<void> {
  await dynamodb.update({
    TableName: 'Tasks',
    Key: { taskId },
    UpdateExpression: 'SET assignedVerifiers = list_append(assignedVerifiers, :worker), updatedAt = :now',
    ExpressionAttributeValues: {
      ':worker': [workerId],
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function updateWorkerStatus(workerId: string, status: string): Promise<void> {
  await dynamodb.update({
    TableName: 'Workers',
    Key: { workerId },
    UpdateExpression: 'SET availability.status = :status, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': status,
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function removeTaskAssignment(taskId: string, workerId: string): Promise<void> {
  // Note: This is a simplified version. In production, you'd need to handle the array manipulation more carefully
  await dynamodb.update({
    TableName: 'Tasks',
    Key: { taskId },
    UpdateExpression: 'SET assignedVerifiers = :workers, updatedAt = :now',
    ExpressionAttributeValues: {
      ':workers': [],  // This should be the filtered array in production
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function emitReclaimEvent(taskId: string, workerId: string, reason: string): Promise<void> {
  await eventBridge.putEvents({
    Entries: [{
      Source: 'aletheia.task-distributor',
      DetailType: 'TaskReclaimed',
      Detail: JSON.stringify({
        taskId,
        workerId,
        reason,
        timestamp: Date.now()
      }),
      EventBusName: process.env.EVENT_BUS_NAME
    }]
  }).promise();
} 