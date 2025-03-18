import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SQS } from '@aws-sdk/client-sqs';
import { createLogger } from '@mindburn/shared';
import { v4 as uuidv4 } from 'uuid';
import { TaskRequestType } from '../types/api';

const logger = createLogger('TaskService');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const sqs = new SQS({});

const TASKS_TABLE = process.env.TASKS_TABLE!;
const TASK_QUEUE_URL = process.env.TASK_QUEUE_URL!;

export class TaskService {
  async submitTask(developerId: string, data: TaskRequestType) {
    const taskId = uuidv4();
    const now = new Date().toISOString();

    logger.info('Submitting new verification task', { taskId, developerId });

    const task = {
      taskId,
      developerId,
      status: 'pending',
      type: data.type,
      requirements: data.requirements,
      priority: data.priority || 'normal',
      callbackUrl: data.callbackUrl,
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
    };

    // Save task to DynamoDB
    await ddb.put({
      TableName: TASKS_TABLE,
      Item: task,
    });

    // Send task to SQS for processing
    await sqs.sendMessage({
      QueueUrl: TASK_QUEUE_URL,
      MessageBody: JSON.stringify({
        taskId,
        developerId,
        type: data.type,
        requirements: data.requirements,
        priority: data.priority,
      }),
    });

    logger.info('Task submitted successfully', { taskId });

    return {
      taskId,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  async getTask(developerId: string, taskId: string) {
    const result = await ddb.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    });

    if (!result.Item) {
      throw new Error('Task not found');
    }

    const task = result.Item;

    // Verify ownership
    if (task.developerId !== developerId) {
      throw new Error('Unauthorized access to task');
    }

    return {
      taskId: task.taskId,
      status: task.status,
      type: task.type,
      requirements: task.requirements,
      priority: task.priority,
      result: task.result,
      error: task.error,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }

  async listTasks(
    developerId: string,
    params: {
      status?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      nextToken?: string;
    }
  ) {
    const limit = params.limit || 50;
    let filterExpression = 'developerId = :developerId';
    let expressionAttributeValues: any = {
      ':developerId': developerId,
    };

    if (params.status) {
      filterExpression += ' AND #status = :status';
      expressionAttributeValues[':status'] = params.status;
    }

    if (params.type) {
      filterExpression += ' AND #type = :type';
      expressionAttributeValues[':type'] = params.type;
    }

    if (params.startDate) {
      filterExpression += ' AND createdAt >= :startDate';
      expressionAttributeValues[':startDate'] = params.startDate;
    }

    if (params.endDate) {
      filterExpression += ' AND createdAt <= :endDate';
      expressionAttributeValues[':endDate'] = params.endDate;
    }

    const queryParams: any = {
      TableName: TASKS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: {
        '#status': 'status',
        '#type': 'type',
      },
      Limit: limit,
    };

    if (params.nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(
        Buffer.from(params.nextToken, 'base64').toString()
      );
    }

    const result = await ddb.query(queryParams);

    return {
      tasks:
        result.Items?.map(task => ({
          taskId: task.taskId,
          status: task.status,
          type: task.type,
          priority: task.priority,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
        })) || [],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    };
  }

  async updateTaskStatus(taskId: string, status: string, data?: any) {
    const now = new Date().toISOString();
    const updateExpression = 'SET #status = :status, updatedAt = :now';
    const expressionAttributeValues: any = {
      ':status': status,
      ':now': now,
    };

    if (status === 'processing') {
      expressionAttributeValues[':startedAt'] = now;
    } else if (status === 'completed' || status === 'failed') {
      expressionAttributeValues[':completedAt'] = now;
      if (data) {
        if (status === 'completed') {
          expressionAttributeValues[':result'] = data;
        } else {
          expressionAttributeValues[':error'] = data;
        }
      }
    }

    await ddb.update({
      TableName: TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    });

    logger.info('Task status updated', { taskId, status });

    return true;
  }

  async cancelTask(developerId: string, taskId: string) {
    const result = await ddb.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    });

    if (!result.Item) {
      throw new Error('Task not found');
    }

    const task = result.Item;

    // Verify ownership
    if (task.developerId !== developerId) {
      throw new Error('Unauthorized access to task');
    }

    // Only allow cancellation of pending or processing tasks
    if (!['pending', 'processing'].includes(task.status)) {
      throw new Error('Cannot cancel completed or failed tasks');
    }

    await this.updateTaskStatus(taskId, 'cancelled');

    logger.info('Task cancelled', { taskId });

    return true;
  }
}
