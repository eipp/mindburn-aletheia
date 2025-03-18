import { DynamoDB, SQS, SNS } from 'aws-sdk';
import { SQSEvent } from 'aws-lambda';

const dynamodb = new DynamoDB.DocumentClient();
const sns = new SNS();
const sqs = new SQS();

interface WorkerScore {
  workerId: string;
  score: number;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { taskId, taskType, requiredWorkers } = message;

      // Get task details
      const taskResult = await dynamodb
        .get({
          TableName: 'Tasks',
          Key: { taskId },
        })
        .promise();

      const task = taskResult.Item;
      if (!task || task.status !== 'PENDING') {
        console.log(`Task ${taskId} not found or not in PENDING status`);
        continue;
      }

      // Find qualified workers
      const workers = await findQualifiedWorkers(taskType, requiredWorkers);
      if (workers.length === 0) {
        console.log(`No qualified workers found for task ${taskId}`);
        await requeueTask(taskId);
        continue;
      }

      // Assign task to workers
      await assignTaskToWorkers(taskId, workers);

      // Update task status
      await dynamodb
        .update({
          TableName: 'Tasks',
          Key: { taskId },
          UpdateExpression: 'SET #status = :status, assignedWorkers = :workers',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'IN_PROGRESS',
            ':workers': workers.map(w => w.workerId),
          },
        })
        .promise();

      // Notify workers
      await notifyWorkers(
        taskId,
        workers.map(w => w.workerId)
      );
    } catch (error) {
      console.error('Error processing task assignment:', error);
      throw error;
    }
  }
};

async function findQualifiedWorkers(
  taskType: string,
  requiredWorkers: number
): Promise<WorkerScore[]> {
  // Query workers by task type and rating
  const result = await dynamodb
    .query({
      TableName: 'Workers',
      IndexName: 'TaskTypeIndex',
      KeyConditionExpression: 'taskType = :taskType',
      FilterExpression: '#status = :status AND currentLoad < :maxLoad',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':taskType': taskType,
        ':status': 'AVAILABLE',
        ':maxLoad': 5, // Maximum concurrent tasks per worker
      },
    })
    .promise();

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  // Calculate worker scores based on multiple factors
  const workerScores = result.Items.map(worker => ({
    workerId: worker.workerId,
    score: calculateWorkerScore(worker),
  }));

  // Sort by score and return top N workers
  return workerScores.sort((a, b) => b.score - a.score).slice(0, requiredWorkers);
}

function calculateWorkerScore(worker: any): number {
  // Weighted scoring based on multiple factors
  const weights = {
    rating: 0.4,
    responseTime: 0.2,
    completionRate: 0.2,
    availability: 0.2,
  };

  return (
    worker.rating * weights.rating +
    (1 - worker.averageResponseTime / 300) * weights.responseTime +
    worker.completionRate * weights.completionRate +
    ((5 - worker.currentLoad) / 5) * weights.availability
  );
}

async function assignTaskToWorkers(taskId: string, workers: WorkerScore[]): Promise<void> {
  const assignments = workers.map(worker => ({
    PutRequest: {
      Item: {
        taskId,
        workerId: worker.workerId,
        status: 'ASSIGNED',
        assignedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours to accept
      },
    },
  }));

  // Batch write assignments
  await dynamodb
    .batchWrite({
      RequestItems: {
        Results: assignments,
      },
    })
    .promise();
}

async function notifyWorkers(taskId: string, workerIds: string[]): Promise<void> {
  const notifications = workerIds.map(workerId => ({
    Message: JSON.stringify({
      type: 'TASK_ASSIGNMENT',
      taskId,
      workerId,
    }),
    TopicArn: process.env.WORKER_NOTIFICATION_TOPIC!,
    MessageAttributes: {
      workerId: {
        DataType: 'String',
        StringValue: workerId,
      },
    },
  }));

  await Promise.all(notifications.map(notification => sns.publish(notification).promise()));
}

async function requeueTask(taskId: string): Promise<void> {
  // Requeue with exponential backoff
  await sqs
    .sendMessage({
      QueueUrl: process.env.TASK_ASSIGNMENT_QUEUE_URL!,
      MessageBody: JSON.stringify({ taskId }),
      DelaySeconds: 300, // 5 minutes delay before retrying
    })
    .promise();
}
