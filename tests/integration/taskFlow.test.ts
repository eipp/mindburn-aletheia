import { DynamoDB, SQS, SNS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus, TaskType, WorkerStatus } from '../../src/types';

const dynamodb = new DynamoDB.DocumentClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
});

const sqs = new SQS({
  region: 'us-east-1',
  endpoint: process.env.SQS_ENDPOINT || 'http://localhost:9324',
});

const sns = new SNS({
  region: 'us-east-1',
  endpoint: process.env.SNS_ENDPOINT || 'http://localhost:9323',
});

describe('Task Management Flow Integration Tests', () => {
  const workerId = uuidv4();
  const taskId = uuidv4();

  beforeAll(async () => {
    // Create test worker
    await dynamodb
      .put({
        TableName: 'Workers',
        Item: {
          workerId,
          status: WorkerStatus.ACTIVE,
          qualifications: {
            taskTypes: [TaskType.TEXT_VERIFICATION],
            languages: ['en'],
          },
          currentLoad: 0,
          maxLoad: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
      .promise();

    // Initialize worker metrics
    await dynamodb
      .put({
        TableName: 'WorkerMetrics',
        Item: {
          workerId,
          metricType: 'ACCURACY',
          value: 0.9,
          updatedAt: new Date().toISOString(),
        },
      })
      .promise();
  });

  afterAll(async () => {
    // Cleanup test data
    await dynamodb
      .delete({
        TableName: 'Workers',
        Key: { workerId },
      })
      .promise();

    await dynamodb
      .delete({
        TableName: 'WorkerMetrics',
        Key: { workerId, metricType: 'ACCURACY' },
      })
      .promise();

    await dynamodb
      .delete({
        TableName: 'Tasks',
        Key: { taskId },
      })
      .promise();
  });

  test('Complete task verification flow', async () => {
    // Create task
    const task = {
      taskId,
      type: TaskType.TEXT_VERIFICATION,
      status: TaskStatus.PENDING,
      data: {
        text: 'Sample text for verification',
        options: ['VALID', 'INVALID'],
      },
      requiredVerifications: 2,
      completedVerifications: 0,
      verificationCriteria: {
        accuracy: 0.8,
        timeLimit: 3600,
      },
      assignedWorkers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    await dynamodb
      .put({
        TableName: 'Tasks',
        Item: task,
      })
      .promise();

    // Send task assignment message
    await sqs
      .sendMessage({
        QueueUrl: process.env.TASK_ASSIGNMENT_QUEUE!,
        MessageBody: JSON.stringify({ taskId }),
      })
      .promise();

    // Wait for task assignment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify task was assigned
    const assignedTask = await dynamodb
      .get({
        TableName: 'Tasks',
        Key: { taskId },
      })
      .promise();

    expect(assignedTask.Item?.status).toBe(TaskStatus.ASSIGNED);
    expect(assignedTask.Item?.assignedWorkers).toContain(workerId);

    // Submit verification result
    const result = {
      taskId,
      workerId,
      result: 'VALID',
      confidence: 0.95,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    };

    await dynamodb
      .put({
        TableName: 'Results',
        Item: result,
      })
      .promise();

    // Send results processing message
    await sqs
      .sendMessage({
        QueueUrl: process.env.RESULTS_PROCESSING_QUEUE!,
        MessageBody: JSON.stringify({ taskId }),
      })
      .promise();

    // Wait for results processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify task completion
    const completedTask = await dynamodb
      .get({
        TableName: 'Tasks',
        Key: { taskId },
      })
      .promise();

    expect(completedTask.Item?.status).toBe(TaskStatus.COMPLETED);
    expect(completedTask.Item?.aggregatedResult).toBeDefined();
    expect(completedTask.Item?.confidence).toBeGreaterThan(0);

    // Verify worker metrics were updated
    const updatedMetrics = await dynamodb
      .get({
        TableName: 'WorkerMetrics',
        Key: { workerId, metricType: 'ACCURACY' },
      })
      .promise();

    expect(updatedMetrics.Item?.value).toBeGreaterThan(0);
  }, 10000);

  test('Task expiration flow', async () => {
    const expiredTaskId = uuidv4();
    const expiredTask = {
      taskId: expiredTaskId,
      type: TaskType.TEXT_VERIFICATION,
      status: TaskStatus.PENDING,
      data: {
        text: 'Sample text for expiration test',
        options: ['VALID', 'INVALID'],
      },
      requiredVerifications: 2,
      completedVerifications: 0,
      verificationCriteria: {
        accuracy: 0.8,
        timeLimit: 1,
      },
      assignedWorkers: [],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };

    await dynamodb
      .put({
        TableName: 'Tasks',
        Item: expiredTask,
      })
      .promise();

    // Send expiration message
    await sqs
      .sendMessage({
        QueueUrl: process.env.TASK_EXPIRATION_QUEUE!,
        MessageBody: JSON.stringify({ taskId: expiredTaskId }),
      })
      .promise();

    // Wait for expiration processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify task expiration
    const expiredTaskResult = await dynamodb
      .get({
        TableName: 'Tasks',
        Key: { taskId: expiredTaskId },
      })
      .promise();

    expect(expiredTaskResult.Item?.status).toBe(TaskStatus.EXPIRED);
    expect(expiredTaskResult.Item?.expirationReason).toBe('TIMEOUT');

    // Cleanup
    await dynamodb
      .delete({
        TableName: 'Tasks',
        Key: { taskId: expiredTaskId },
      })
      .promise();
  }, 10000);
});
