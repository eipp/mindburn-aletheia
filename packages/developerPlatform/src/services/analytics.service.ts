import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('AnalyticsService');
const ddb = DynamoDBDocument.from(new DynamoDB({}));

const TASKS_TABLE = process.env.TASKS_TABLE!;
const BILLING_TABLE = process.env.BILLING_TABLE!;

export class AnalyticsService {
  async getTaskMetrics(developerId: string, params: {
    startDate: string,
    endDate: string,
    type?: string
  }) {
    logger.info('Fetching task metrics', { developerId, ...params });

    let filterExpression = 'developerId = :developerId AND createdAt BETWEEN :startDate AND :endDate';
    let expressionAttributeValues: any = {
      ':developerId': developerId,
      ':startDate': params.startDate,
      ':endDate': params.endDate
    };

    if (params.type) {
      filterExpression += ' AND #type = :type';
      expressionAttributeValues[':type'] = params.type;
    }

    const result = await ddb.query({
      TableName: TASKS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: params.type ? { '#type': 'type' } : undefined
    });

    const tasks = result.Items || [];
    const metrics = {
      total: tasks.length,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      cancelled: 0,
      avgProcessingTime: 0,
      avgCompletionTime: 0
    };

    let totalProcessingTime = 0;
    let totalCompletionTime = 0;
    let processedCount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      metrics[task.status]++;

      if (task.startedAt && task.status !== 'pending') {
        const processingTime = new Date(task.completedAt || new Date()).getTime() - 
                             new Date(task.startedAt).getTime();
        totalProcessingTime += processingTime;
        processedCount++;
      }

      if (task.completedAt && task.status === 'completed') {
        const completionTime = new Date(task.completedAt).getTime() - 
                             new Date(task.createdAt).getTime();
        totalCompletionTime += completionTime;
        completedCount++;
      }
    });

    if (processedCount > 0) {
      metrics.avgProcessingTime = totalProcessingTime / processedCount;
    }

    if (completedCount > 0) {
      metrics.avgCompletionTime = totalCompletionTime / completedCount;
    }

    return metrics;
  }

  async getBillingMetrics(developerId: string, params: {
    startDate: string,
    endDate: string,
    type?: string
  }) {
    logger.info('Fetching billing metrics', { developerId, ...params });

    let filterExpression = 'developerId = :developerId AND billingDate BETWEEN :startDate AND :endDate';
    let expressionAttributeValues: any = {
      ':developerId': developerId,
      ':startDate': params.startDate,
      ':endDate': params.endDate
    };

    if (params.type) {
      filterExpression += ' AND #type = :type';
      expressionAttributeValues[':type'] = params.type;
    }

    const result = await ddb.query({
      TableName: BILLING_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: params.type ? { '#type': 'type' } : undefined
    });

    const billingRecords = result.Items || [];
    const metrics = {
      totalAmount: 0,
      totalTasks: 0,
      avgCostPerTask: 0,
      costByType: {} as Record<string, number>,
      tasksByType: {} as Record<string, number>
    };

    billingRecords.forEach(record => {
      metrics.totalAmount += record.amount;
      metrics.totalTasks += record.taskCount;
      
      if (!metrics.costByType[record.type]) {
        metrics.costByType[record.type] = 0;
        metrics.tasksByType[record.type] = 0;
      }
      
      metrics.costByType[record.type] += record.amount;
      metrics.tasksByType[record.type] += record.taskCount;
    });

    if (metrics.totalTasks > 0) {
      metrics.avgCostPerTask = metrics.totalAmount / metrics.totalTasks;
    }

    return metrics;
  }

  async getUsageQuota(developerId: string) {
    logger.info('Fetching usage quota', { developerId });

    const result = await ddb.get({
      TableName: BILLING_TABLE,
      Key: { developerId },
      ProjectionExpression: 'quota, usage'
    });

    if (!result.Item) {
      return {
        quota: {
          maxTasks: 1000,
          maxConcurrent: 10,
          maxStorage: 1024 * 1024 * 100 // 100MB
        },
        usage: {
          tasks: 0,
          concurrent: 0,
          storage: 0
        }
      };
    }

    return {
      quota: result.Item.quota,
      usage: result.Item.usage
    };
  }

  async trackUsage(developerId: string, data: {
    tasks?: number,
    concurrent?: number,
    storage?: number
  }) {
    logger.info('Tracking usage', { developerId, ...data });

    const updateExpressions = [];
    const expressionAttributeValues: any = {};

    if (data.tasks !== undefined) {
      updateExpressions.push('usage.tasks = usage.tasks + :taskDelta');
      expressionAttributeValues[':taskDelta'] = data.tasks;
    }

    if (data.concurrent !== undefined) {
      updateExpressions.push('usage.concurrent = :concurrent');
      expressionAttributeValues[':concurrent'] = data.concurrent;
    }

    if (data.storage !== undefined) {
      updateExpressions.push('usage.storage = usage.storage + :storageDelta');
      expressionAttributeValues[':storageDelta'] = data.storage;
    }

    if (updateExpressions.length === 0) {
      return;
    }

    await ddb.update({
      TableName: BILLING_TABLE,
      Key: { developerId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues
    });
  }

  async getDailyTaskBreakdown(developerId: string, params: {
    startDate: string,
    endDate: string,
    type?: string
  }) {
    logger.info('Fetching daily task breakdown', { developerId, ...params });

    let filterExpression = 'developerId = :developerId AND createdAt BETWEEN :startDate AND :endDate';
    let expressionAttributeValues: any = {
      ':developerId': developerId,
      ':startDate': params.startDate,
      ':endDate': params.endDate
    };

    if (params.type) {
      filterExpression += ' AND #type = :type';
      expressionAttributeValues[':type'] = params.type;
    }

    const result = await ddb.query({
      TableName: TASKS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: params.type ? { '#type': 'type' } : undefined
    });

    const breakdown: Record<string, {
      total: number;
      completed: number;
      failed: number;
      avgProcessingTime: number;
    }> = {};

    (result.Items || []).forEach(task => {
      const date = task.createdAt.split('T')[0];
      
      if (!breakdown[date]) {
        breakdown[date] = {
          total: 0,
          completed: 0,
          failed: 0,
          avgProcessingTime: 0
        };
      }

      breakdown[date].total++;
      
      if (task.status === 'completed') {
        breakdown[date].completed++;
        if (task.startedAt && task.completedAt) {
          const processingTime = new Date(task.completedAt).getTime() - 
                               new Date(task.startedAt).getTime();
          breakdown[date].avgProcessingTime = 
            (breakdown[date].avgProcessingTime * (breakdown[date].completed - 1) + processingTime) / 
            breakdown[date].completed;
        }
      } else if (task.status === 'failed') {
        breakdown[date].failed++;
      }
    });

    return breakdown;
  }
} 