import { DynamoDB, Backup } from '@aws-sdk/client-dynamodb';
import { createLogger } from '@mindburn/shared';
import { SNS } from '@aws-sdk/client-sns';

const logger = createLogger('BackupManager');

export class BackupManager {
  constructor(
    private readonly dynamodb: DynamoDB,
    private readonly sns: SNS,
    private readonly config: {
      tableName: string;
      backupRetentionDays: number;
      notificationTopicArn: string;
      environment: string;
    }
  ) {}

  async enablePointInTimeRecovery() {
    try {
      logger.info('Enabling point-in-time recovery', {
        tableName: this.config.tableName
      });

      await this.dynamodb.updateContinuousBackups({
        TableName: this.config.tableName,
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true
        }
      });

      logger.info('Point-in-time recovery enabled successfully');
    } catch (error) {
      logger.error('Failed to enable point-in-time recovery', { error });
      throw error;
    }
  }

  async createBackup(description: string = 'Automated backup') {
    try {
      const timestamp = new Date().toISOString();
      const backupName = `${this.config.tableName}-${timestamp}`;

      logger.info('Creating backup', { backupName });

      const result = await this.dynamodb.createBackup({
        TableName: this.config.tableName,
        BackupName: backupName,
        Tags: [
          {
            Key: 'Environment',
            Value: this.config.environment
          },
          {
            Key: 'Service',
            Value: 'verification-engine'
          },
          {
            Key: 'CreatedAt',
            Value: timestamp
          },
          {
            Key: 'Description',
            Value: description
          }
        ]
      });

      logger.info('Backup created successfully', {
        backupArn: result.BackupDetails?.BackupArn
      });

      await this.notifyBackupStatus('created', result.BackupDetails);
      return result.BackupDetails;
    } catch (error) {
      logger.error('Failed to create backup', { error });
      await this.notifyBackupStatus('failed', null, error);
      throw error;
    }
  }

  async listBackups() {
    try {
      logger.info('Listing backups');

      const result = await this.dynamodb.listBackups({
        TableName: this.config.tableName
      });

      return result.BackupSummaries || [];
    } catch (error) {
      logger.error('Failed to list backups', { error });
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      logger.info('Cleaning up old backups');

      const backups = await this.listBackups();
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.backupRetentionDays);

      for (const backup of backups) {
        if (backup.BackupCreationDateTime && backup.BackupCreationDateTime < retentionDate) {
          await this.deleteBackup(backup.BackupArn!);
        }
      }

      logger.info('Old backups cleaned up successfully');
    } catch (error) {
      logger.error('Failed to clean up old backups', { error });
      throw error;
    }
  }

  async deleteBackup(backupArn: string) {
    try {
      logger.info('Deleting backup', { backupArn });

      await this.dynamodb.deleteBackup({
        BackupArn: backupArn
      });

      logger.info('Backup deleted successfully', { backupArn });
    } catch (error) {
      logger.error('Failed to delete backup', { error, backupArn });
      throw error;
    }
  }

  async restoreFromBackup(backupArn: string, targetTableName: string) {
    try {
      logger.info('Restoring from backup', { backupArn, targetTableName });

      const result = await this.dynamodb.restoreTableFromBackup({
        BackupArn: backupArn,
        TargetTableName: targetTableName
      });

      logger.info('Restore initiated successfully', {
        targetTableName,
        tableStatus: result.TableDescription?.TableStatus
      });

      await this.notifyBackupStatus('restored', result.TableDescription);
      return result.TableDescription;
    } catch (error) {
      logger.error('Failed to restore from backup', { error, backupArn });
      await this.notifyBackupStatus('restore_failed', null, error);
      throw error;
    }
  }

  private async notifyBackupStatus(
    status: 'created' | 'failed' | 'restored' | 'restore_failed',
    details: any,
    error?: any
  ) {
    try {
      await this.sns.publish({
        TopicArn: this.config.notificationTopicArn,
        Message: JSON.stringify({
          status,
          tableName: this.config.tableName,
          environment: this.config.environment,
          timestamp: new Date().toISOString(),
          details,
          error: error ? {
            message: error.message,
            code: error.code
          } : undefined
        }),
        MessageAttributes: {
          'Environment': {
            DataType: 'String',
            StringValue: this.config.environment
          },
          'Service': {
            DataType: 'String',
            StringValue: 'verification-engine'
          },
          'Status': {
            DataType: 'String',
            StringValue: status
          }
        }
      });
    } catch (error) {
      logger.error('Failed to send backup notification', { error });
    }
  }
} 