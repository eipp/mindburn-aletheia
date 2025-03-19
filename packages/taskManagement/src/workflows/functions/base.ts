import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { WorkflowContext } from '../types/workflow';

export abstract class WorkflowHandler {
  protected readonly dynamodb: DynamoDB.DocumentClient;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly tableName: string;

  constructor(tableName: string) {
    this.dynamodb = new DynamoDB.DocumentClient();
    this.logger = createLogger(this.constructor.name);
    this.tableName = tableName;
  }

  protected async getTask(taskId: string) {
    try {
      const result = await this.dynamodb
        .get({
          TableName: this.tableName,
          Key: { taskId },
        })
        .promise();

      return result.Item;
    } catch (error) {
      this.logger.error('Error getting task', { taskId, error });
      throw error;
    }
  }

  protected async updateTask(taskId: string, updateExpression: string, expressionValues: any) {
    try {
      await this.dynamodb
        .update({
          TableName: this.tableName,
          Key: { taskId },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionValues,
          ReturnValues: 'NONE',
        })
        .promise();
    } catch (error) {
      this.logger.error('Error updating task', { taskId, error });
      throw error;
    }
  }

  protected handleError(error: Error, context: WorkflowContext) {
    this.logger.error('Workflow step error', {
      error,
      executionId: context.executionId,
      taskId: context.taskData?.taskId,
    });

    return {
      error: error.message,
      isRecoverable: this.isRecoverableError(error),
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private isRecoverableError(error: Error): boolean {
    const nonRecoverableErrors = [
      'ValidationError',
      'ResourceNotFoundException',
      'InvalidParameterException',
    ];
    return !nonRecoverableErrors.includes(error.name);
  }

  protected validateInput(input: any, requiredFields: string[]) {
    for (const field of requiredFields) {
      if (!input[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}
