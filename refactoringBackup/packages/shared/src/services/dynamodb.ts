import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, GetCommandInput, PutCommandInput, QueryCommandInput, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { WorkerProfile, Transaction, BaseTask } from '../types';

export class DynamoDBService {
  private client: DynamoDBDocument;
  private tablePrefix: string;

  constructor(config: {
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    tablePrefix?: string;
  }) {
    const client = new DynamoDBClient({
      region: config.region,
      credentials: config.credentials
    });

    this.client = DynamoDBDocument.from(client);
    this.tablePrefix = config.tablePrefix || '';
  }

  private getTableName(table: string): string {
    return `${this.tablePrefix}${table}`;
  }

  // Worker Profile Operations
  async getWorkerProfile(userId: string): Promise<WorkerProfile | null> {
    const params: GetCommandInput = {
      TableName: this.getTableName('users'),
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
      TableName: this.getTableName('users'),
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
      TableName: this.getTableName('users'),
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

  // Task Operations
  async getTask(taskId: string): Promise<BaseTask | null> {
    const params: GetCommandInput = {
      TableName: this.getTableName('tasks'),
      Key: { id: taskId }
    };

    try {
      const result = await this.client.get(params);
      return result.Item as BaseTask || null;
    } catch (error) {
      console.error('Error getting task:', error);
      return null;
    }
  }

  async updateTask(taskId: string, updates: Partial<BaseTask>): Promise<boolean> {
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
      TableName: this.getTableName('tasks'),
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

  // Transaction Operations
  async getTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    const params: QueryCommandInput = {
      TableName: this.getTableName('transactions'),
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
      TableName: this.getTableName('transactions'),
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