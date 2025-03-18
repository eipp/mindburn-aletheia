import { DynamoDB, SNS, SQS } from 'aws-sdk';
import { SQSEvent } from 'aws-lambda';

const dynamodb = new DynamoDB.DocumentClient();
const sns = new SNS();
const sqs = new SQS();

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { taskId } = message;

      // Get task details
      const taskResult = await dynamodb.get({
        TableName: 'Tasks',
        Key: { taskId }
      }).promise();

      const task = taskResult.Item;
      if (!task) {
        console.log(`Task ${taskId} not found`);
        continue;
      }

      // Check if task is already completed or failed
      if (['COMPLETED', 'FAILED', 'EXPIRED'].includes(task.status)) {
        console.log(`Task ${taskId} already in final state: ${task.status}`);
        continue;
      }

      // Handle task expiration
      await handleTaskExpiration(task);

      // Clean up any pending worker assignments
      await cleanupWorkerAssignments(task);

      // Update worker metrics for non-responsive workers
      await updateWorkerMetrics(task);

      // Notify task expiration
      await notifyTaskExpiration(task);

    } catch (error) {
      console.error('Error processing task expiration:', error);
      throw error;
    }
  }
};

async function handleTaskExpiration(task: any): Promise<void> {
  // Update task status to EXPIRED
  await dynamodb.update({
    TableName: 'Tasks',
    Key: { taskId: task.taskId },
    UpdateExpression: 'SET #status = :status, expirationReason = :reason, expiredAt = :expiredAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'EXPIRED',
      ':reason': determineExpirationReason(task),
      ':expiredAt': new Date().toISOString()
    }
  }).promise();
}

function determineExpirationReason(task: any): string {
  if (!task.assignedWorkers?.length) {
    return 'NO_WORKERS_ASSIGNED';
  }
  if (task.completedVerifications < task.requiredVerifications) {
    return 'INSUFFICIENT_VERIFICATIONS';
  }
  return 'TIMEOUT';
}

async function cleanupWorkerAssignments(task: any): Promise<void> {
  if (!task.assignedWorkers?.length) {
    return;
  }

  // Get all pending assignments
  const pendingAssignments = await dynamodb.query({
    TableName: 'Results',
    KeyConditionExpression: 'taskId = :taskId',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':taskId': task.taskId,
      ':status': 'ASSIGNED'
    }
  }).promise();

  if (!pendingAssignments.Items?.length) {
    return;
  }

  // Update assignments to EXPIRED
  const updates = pendingAssignments.Items.map(assignment => 
    dynamodb.update({
      TableName: 'Results',
      Key: {
        taskId: task.taskId,
        workerId: assignment.workerId
      },
      UpdateExpression: 'SET #status = :status, expiredAt = :expiredAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'EXPIRED',
        ':expiredAt': new Date().toISOString()
      }
    }).promise()
  );

  await Promise.all(updates);
}

async function updateWorkerMetrics(task: any): Promise<void> {
  if (!task.assignedWorkers?.length) {
    return;
  }

  // Get all assignments for the task
  const assignments = await dynamodb.query({
    TableName: 'Results',
    KeyConditionExpression: 'taskId = :taskId',
    ExpressionAttributeValues: {
      ':taskId': task.taskId
    }
  }).promise();

  if (!assignments.Items?.length) {
    return;
  }

  // Update metrics for non-responsive workers
  const updates = assignments.Items
    .filter(assignment => assignment.status === 'ASSIGNED')
    .map(assignment => updateWorkerResponseMetric(assignment.workerId));

  await Promise.all(updates);
}

async function updateWorkerResponseMetric(workerId: string): Promise<void> {
  // Update response rate metric
  await dynamodb.update({
    TableName: 'WorkerMetrics',
    Key: {
      workerId,
      metricType: 'RESPONSE_RATE'
    },
    UpdateExpression: 'SET #value = :newValue',
    ExpressionAttributeNames: {
      '#value': 'value'
    },
    ExpressionAttributeValues: {
      ':newValue': dynamodb.createSet(['DECREMENT']) // Using atomic counter
    }
  }).promise();

  // Update availability status if response rate is too low
  const metrics = await dynamodb.get({
    TableName: 'WorkerMetrics',
    Key: {
      workerId,
      metricType: 'RESPONSE_RATE'
    }
  }).promise();

  if (metrics.Item?.value < 0.5) { // 50% response rate threshold
    await dynamodb.update({
      TableName: 'Workers',
      Key: { workerId },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'SUSPENDED'
      }
    }).promise();
  }
}

async function notifyTaskExpiration(task: any): Promise<void> {
  // Notify developer
  await sns.publish({
    TopicArn: process.env.TASK_NOTIFICATION_TOPIC!,
    Message: JSON.stringify({
      type: 'TASK_EXPIRED',
      taskId: task.taskId,
      reason: task.expirationReason,
      expiredAt: task.expiredAt
    }),
    MessageAttributes: {
      'taskId': {
        DataType: 'String',
        StringValue: task.taskId
      }
    }
  }).promise();

  // Notify assigned workers
  if (task.assignedWorkers?.length) {
    await sns.publish({
      TopicArn: process.env.WORKER_NOTIFICATION_TOPIC!,
      Message: JSON.stringify({
        type: 'TASK_EXPIRED',
        taskId: task.taskId
      }),
      MessageAttributes: {
        'workerIds': {
          DataType: 'String.Array',
          StringValue: JSON.stringify(task.assignedWorkers)
        }
      }
    }).promise();
  }
} 