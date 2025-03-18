import { DynamoDB } from 'aws-sdk';

export interface PaymentBatch {
  batchId: string;
  payments: {
    destinationAddress: string;
    amount: number;
    referenceId?: string;
  }[];
  totalAmount: number;
  estimatedFee: number;
  status: 'pending' | 'processing' | 'completed' | 'partial_failure' | 'failed';
  results?: {
    successful: number;
    failed: number;
    transactions: {
      referenceId?: string;
      destinationAddress: string;
      amount: number;
      status: string;
      transactionHash?: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export class PaymentBatchModel {
  private dynamoDB: DynamoDB.DocumentClient;
  private tableName: string;

  constructor() {
    this.dynamoDB = new DynamoDB.DocumentClient();
    this.tableName = process.env.PAYMENT_BATCHES_TABLE!;
  }

  async create(batch: Omit<PaymentBatch, 'createdAt' | 'updatedAt'>): Promise<PaymentBatch> {
    const now = new Date().toISOString();
    const item: PaymentBatch = {
      ...batch,
      createdAt: now,
      updatedAt: now
    };

    await this.dynamoDB.put({
      TableName: this.tableName,
      Item: item
    }).promise();

    return item;
  }

  async get(batchId: string): Promise<PaymentBatch | null> {
    const result = await this.dynamoDB.get({
      TableName: this.tableName,
      Key: { batchId }
    }).promise();

    return result.Item as PaymentBatch || null;
  }

  async update(batchId: string, updates: Partial<PaymentBatch>): Promise<PaymentBatch> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'batchId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const result = await this.dynamoDB.update({
      TableName: this.tableName,
      Key: { batchId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }).promise();

    return result.Attributes as PaymentBatch;
  }

  async listPending(): Promise<PaymentBatch[]> {
    const result = await this.dynamoDB.query({
      TableName: this.tableName,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'pending'
      }
    }).promise();

    return result.Items as PaymentBatch[];
  }

  async delete(batchId: string): Promise<void> {
    await this.dynamoDB.delete({
      TableName: this.tableName,
      Key: { batchId }
    }).promise();
  }
} 