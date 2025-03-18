import { DynamoDB, SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamodb = new DynamoDB.DocumentClient();
const sqs = new SQS();

interface TaskInput {
  taskType: string;
  prompt: string;
  expectedResult: any;
  verificationCriteria: {
    accuracy: number;
    requiredWorkers: number;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const taskInput: TaskInput = JSON.parse(event.body || '');
    const taskId = uuidv4();
    const now = new Date().toISOString();
    
    // Calculate task expiration (24 hours from creation)
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

    // Create task record
    const task = {
      taskId,
      ...taskInput,
      status: 'PENDING',
      createdAt: now,
      expiresAt,
      assignedWorkers: [],
      completedVerifications: 0,
      requiredVerifications: taskInput.verificationCriteria.requiredWorkers
    };

    // Save task to DynamoDB
    await dynamodb.put({
      TableName: 'Tasks',
      Item: task
    }).promise();

    // Send task to assignment queue
    await sqs.sendMessage({
      QueueUrl: process.env.TASK_ASSIGNMENT_QUEUE_URL!,
      MessageBody: JSON.stringify({
        taskId,
        taskType: taskInput.taskType,
        requiredWorkers: taskInput.verificationCriteria.requiredWorkers
      }),
      MessageAttributes: {
        taskType: {
          DataType: 'String',
          StringValue: taskInput.taskType
        }
      }
    }).promise();

    // Schedule task expiration
    await sqs.sendMessage({
      QueueUrl: process.env.TASK_EXPIRATION_QUEUE_URL!,
      MessageBody: JSON.stringify({ taskId }),
      DelaySeconds: 24 * 60 * 60 // 24 hours
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({
        taskId,
        status: 'PENDING',
        message: 'Task created successfully'
      })
    };

  } catch (error) {
    console.error('Error creating task:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating task',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 