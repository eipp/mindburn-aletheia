import { DynamoDB } from 'aws-sdk';
import { Logger } from '@mindburn/shared/logger';
import {
  WorkerProfile,
  WorkerStatus,
  OnboardingMetadata,
  WorkerActivityMetrics,
  SkillAssessmentResult,
} from '../types';

export class WorkerRepository {
  private readonly dynamoDB: DynamoDB.DocumentClient;
  private readonly tableName: string;
  private readonly logger: Logger;

  constructor(dynamoDB: DynamoDB.DocumentClient, tableName: string, logger: Logger) {
    this.dynamoDB = dynamoDB;
    this.tableName = tableName;
    this.logger = logger.child({ repository: 'WorkerRepository' });
  }

  async createWorker(worker: WorkerProfile): Promise<WorkerProfile> {
    try {
      await this.dynamoDB
        .put({
          TableName: this.tableName,
          Item: {
            PK: `WORKER#${worker.workerId}`,
            SK: 'PROFILE',
            ...worker,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
        .promise();

      this.logger.info('Worker profile created', { workerId: worker.workerId });
      return worker;
    } catch (error) {
      this.logger.error('Failed to create worker profile', {
        error,
        workerId: worker.workerId,
      });
      throw error;
    }
  }

  async getWorkerById(workerId: string): Promise<WorkerProfile | null> {
    try {
      const result = await this.dynamoDB
        .get({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${workerId}`,
            SK: 'PROFILE',
          },
        })
        .promise();

      if (!result.Item) {
        this.logger.info('Worker profile not found', { workerId });
        return null;
      }

      const { PK, SK, createdAt, updatedAt, ...workerProfile } = result.Item;
      return workerProfile as WorkerProfile;
    } catch (error) {
      this.logger.error('Failed to get worker profile', {
        error,
        workerId,
      });
      throw error;
    }
  }

  async updateWorkerProfile(worker: WorkerProfile): Promise<WorkerProfile> {
    try {
      const updateExpression = this.buildUpdateExpression(worker);

      await this.dynamoDB
        .update({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${worker.workerId}`,
            SK: 'PROFILE',
          },
          ...updateExpression,
          UpdateExpression: `${updateExpression.UpdateExpression} SET updatedAt = :updatedAt`,
          ExpressionAttributeValues: {
            ...updateExpression.ExpressionAttributeValues,
            ':updatedAt': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(PK)',
        })
        .promise();

      this.logger.info('Worker profile updated', { workerId: worker.workerId });
      return worker;
    } catch (error) {
      this.logger.error('Failed to update worker profile', {
        error,
        workerId: worker.workerId,
      });
      throw error;
    }
  }

  async updateWorkerStatus(workerId: string, status: WorkerStatus, reason?: string): Promise<void> {
    try {
      await this.dynamoDB
        .update({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${workerId}`,
            SK: 'PROFILE',
          },
          UpdateExpression:
            'SET #status = :status, statusHistory = list_append(if_not_exists(statusHistory, :empty_list), :status_change), updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
            ':status_change': [
              {
                status,
                timestamp: new Date().toISOString(),
                reason,
              },
            ],
            ':empty_list': [],
            ':updatedAt': new Date().toISOString(),
          },
        })
        .promise();

      this.logger.info('Worker status updated', { workerId, status, reason });
    } catch (error) {
      this.logger.error('Failed to update worker status', {
        error,
        workerId,
        status,
      });
      throw error;
    }
  }

  async updateWorkerSkills(
    workerId: string,
    assessmentResults: Record<string, SkillAssessmentResult>
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();

      await this.dynamoDB
        .update({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${workerId}`,
            SK: 'PROFILE',
          },
          UpdateExpression: `
          SET skills = :skills,
          lastSkillAssessment = :assessment,
          updatedAt = :updatedAt
        `,
          ExpressionAttributeValues: {
            ':skills': Object.keys(assessmentResults),
            ':assessment': {
              timestamp,
              results: assessmentResults,
            },
            ':updatedAt': timestamp,
          },
        })
        .promise();

      this.logger.info('Worker skills updated', {
        workerId,
        skills: Object.keys(assessmentResults),
      });
    } catch (error) {
      this.logger.error('Failed to update worker skills', {
        error,
        workerId,
      });
      throw error;
    }
  }

  async updateWorkerActivityMetrics(
    workerId: string,
    metrics: WorkerActivityMetrics
  ): Promise<void> {
    try {
      await this.dynamoDB
        .update({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${workerId}`,
            SK: 'PROFILE',
          },
          UpdateExpression: 'SET activityMetrics = :metrics, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':metrics': metrics,
            ':updatedAt': new Date().toISOString(),
          },
        })
        .promise();

      this.logger.info('Worker activity metrics updated', { workerId });
    } catch (error) {
      this.logger.error('Failed to update worker activity metrics', {
        error,
        workerId,
      });
      throw error;
    }
  }

  async updateOnboardingMetadata(workerId: string, metadata: OnboardingMetadata): Promise<void> {
    try {
      await this.dynamoDB
        .update({
          TableName: this.tableName,
          Key: {
            PK: `WORKER#${workerId}`,
            SK: 'PROFILE',
          },
          UpdateExpression: 'SET metadata.onboarding = :metadata, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':metadata': metadata,
            ':updatedAt': new Date().toISOString(),
          },
        })
        .promise();

      this.logger.info('Worker onboarding metadata updated', { workerId });
    } catch (error) {
      this.logger.error('Failed to update worker onboarding metadata', {
        error,
        workerId,
      });
      throw error;
    }
  }

  async getActiveWorkers(): Promise<WorkerProfile[]> {
    try {
      const result = await this.dynamoDB
        .query({
          TableName: this.tableName,
          IndexName: 'StatusIndex',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': WorkerStatus.AVAILABLE,
          },
        })
        .promise();

      return (result.Items || []).map(
        ({ PK, SK, createdAt, updatedAt, ...worker }) => worker as WorkerProfile
      );
    } catch (error) {
      this.logger.error('Failed to get active workers', { error });
      throw error;
    }
  }

  private buildUpdateExpression(worker: Partial<WorkerProfile>): {
    UpdateExpression: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, any>;
  } {
    const updates: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    Object.entries(worker).forEach(([key, value]) => {
      if (key !== 'workerId' && value !== undefined) {
        const nameKey = `#${key}`;
        const valueKey = `:${key}`;
        updates.push(`${nameKey} = ${valueKey}`);
        names[nameKey] = key;
        values[valueKey] = value;
      }
    });

    return {
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    };
  }
}
