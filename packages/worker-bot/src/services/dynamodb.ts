import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, GetCommandInput, PutCommandInput, QueryCommandInput, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { WorkerProfile, Task, Transaction } from '../types';

export class DynamoDBService {
  private client: DynamoDBDocument;
  private tablePrefix: string;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });

    this.client = DynamoDBDocument.from(client);
    this.tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || '';
  }

  private getTableName(table: string): string {
    return `${this.tablePrefix}${table}`;
  }

  async getWorkerProfile(userId: string): Promise<WorkerProfile | null> {
    const params: GetCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_USERS_TABLE!),
      Key: { userId }
    };

    try {
      const result = await this.client.get(params);
      return result.Item as WorkerProfile || null;
    } catch (error) {
      console.error('Error getting worker profile:', error);
      return null;
    }
  }

  async updateWorkerProfile(profile: Partial<WorkerProfile> & { userId: string }): Promise<boolean> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(profile).forEach(([key, value]) => {
      if (key !== 'userId' && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const params: UpdateCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_USERS_TABLE!),
      Key: { userId: profile.userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    };

    try {
      await this.client.update(params);
      return true;
    } catch (error) {
      console.error('Error updating worker profile:', error);
      return false;
    }
  }

  async createWorkerProfile(profile: WorkerProfile): Promise<boolean> {
    const params: PutCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_USERS_TABLE!),
      Item: profile
    };

    try {
      await this.client.put(params);
      return true;
    } catch (error) {
      console.error('Error creating worker profile:', error);
      return false;
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    const params: GetCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_TASKS_TABLE!),
      Key: { id: taskId }
    };

    try {
      const result = await this.client.get(params);
      return result.Item as Task || null;
    } catch (error) {
      console.error('Error getting task:', error);
      return null;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const params: UpdateCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_TASKS_TABLE!),
      Key: { id: taskId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    };

    try {
      await this.client.update(params);
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  }

  async getTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    const params: QueryCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_TRANSACTIONS_TABLE!),
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false
    };

    try {
      const result = await this.client.query(params);
      return result.Items as Transaction[] || [];
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  async createTransaction(transaction: Transaction): Promise<boolean> {
    const params: PutCommandInput = {
      TableName: this.getTableName(process.env.DYNAMODB_TRANSACTIONS_TABLE!),
      Item: transaction
    };

    try {
      await this.client.put(params);
      return true;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return false;
    }
  }
} 