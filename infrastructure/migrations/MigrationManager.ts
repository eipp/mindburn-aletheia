import { DynamoDB, S3, CloudWatch } from 'aws-sdk';
import { Pool } from 'pg';
import { Logger } from '../utils/Logger';

interface MigrationRecord {
  version: string;
  description: string;
  type: 'dynamodb' | 'sql';
  appliedAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  checksum: string;
  duration: number;
  error?: string;
}

interface MigrationContext {
  dynamodb: DynamoDB.DocumentClient;
  postgres: Pool;
  s3: S3;
  cloudwatch: CloudWatch;
  logger: Logger;
  environment: string;
}

export abstract class Migration {
  constructor(
    protected context: MigrationContext,
    protected version: string,
    protected description: string
  ) {}

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
  abstract validate(): Promise<boolean>;
  abstract generateChecksum(): string;
}

export class MigrationManager {
  private readonly migrationsTable = 'DatabaseMigrations';
  private readonly backupBucket = 'mindburn-db-backups';
  private readonly metricsNamespace = 'Mindburn/Migrations';

  constructor(private context: MigrationContext) {}

  async initialize(): Promise<void> {
    await this.ensureMigrationsTableExists();
    await this.ensureBackupBucketExists();
  }

  private async ensureMigrationsTableExists(): Promise<void> {
    try {
      await this.context.dynamodb.describeTable({
        TableName: this.migrationsTable
      }).promise();
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        await this.createMigrationsTable();
      } else {
        throw error;
      }
    }
  }

  private async createMigrationsTable(): Promise<void> {
    await this.context.dynamodb.createTable({
      TableName: this.migrationsTable,
      KeySchema: [
        { AttributeName: 'version', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'version', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' },
        { AttributeName: 'appliedAt', AttributeType: 'N' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'StatusIndex',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'appliedAt', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }).promise();
  }

  private async ensureBackupBucketExists(): Promise<void> {
    try {
      await this.context.s3.headBucket({
        Bucket: this.backupBucket
      }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        await this.context.s3.createBucket({
          Bucket: this.backupBucket,
          ObjectLockEnabledForBucket: true
        }).promise();

        await this.context.s3.putBucketVersioning({
          Bucket: this.backupBucket,
          VersioningConfiguration: { Status: 'Enabled' }
        }).promise();
      } else {
        throw error;
      }
    }
  }

  async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    const checksum = migration.generateChecksum();

    try {
      // Record migration start
      await this.recordMigrationStatus({
        version: migration.version,
        description: migration.description,
        type: this.getMigrationType(migration),
        status: 'in_progress',
        appliedAt: startTime,
        checksum,
        duration: 0
      });

      // Create backup
      await this.createBackup(migration);

      // Apply migration
      await migration.up();

      // Validate migration
      const isValid = await migration.validate();
      if (!isValid) {
        throw new Error('Migration validation failed');
      }

      // Record successful completion
      await this.recordMigrationStatus({
        version: migration.version,
        description: migration.description,
        type: this.getMigrationType(migration),
        status: 'completed',
        appliedAt: startTime,
        checksum,
        duration: Date.now() - startTime
      });

      // Publish metrics
      await this.publishMetrics(migration, true, Date.now() - startTime);

    } catch (error) {
      this.context.logger.error('Migration failed:', error);

      // Record failure
      await this.recordMigrationStatus({
        version: migration.version,
        description: migration.description,
        type: this.getMigrationType(migration),
        status: 'failed',
        appliedAt: startTime,
        checksum,
        duration: Date.now() - startTime,
        error: error.message
      });

      // Publish failure metrics
      await this.publishMetrics(migration, false, Date.now() - startTime);

      // Attempt rollback
      await this.rollbackMigration(migration);
      throw error;
    }
  }

  private async createBackup(migration: Migration): Promise<void> {
    const timestamp = new Date().toISOString();
    const backupKey = `${this.context.environment}/${migration.version}/${timestamp}`;

    if (this.getMigrationType(migration) === 'dynamodb') {
      // Create DynamoDB backup
      const tables = await this.getAffectedTables(migration);
      for (const table of tables) {
        await this.context.dynamodb.createBackup({
          TableName: table,
          BackupName: `${backupKey}-${table}`
        }).promise();
      }
    } else {
      // Create PostgreSQL backup
      const dumpFile = await this.createPostgresDump();
      await this.context.s3.putObject({
        Bucket: this.backupBucket,
        Key: `${backupKey}-postgres.dump`,
        Body: dumpFile
      }).promise();
    }
  }

  private async rollbackMigration(migration: Migration): Promise<void> {
    try {
      await migration.down();
      
      await this.recordMigrationStatus({
        version: migration.version,
        description: migration.description,
        type: this.getMigrationType(migration),
        status: 'rolled_back',
        appliedAt: Date.now(),
        checksum: migration.generateChecksum(),
        duration: 0
      });
    } catch (error) {
      this.context.logger.error('Rollback failed:', error);
      throw new Error(`Migration rollback failed: ${error.message}`);
    }
  }

  private async publishMetrics(
    migration: Migration,
    success: boolean,
    duration: number
  ): Promise<void> {
    const metrics = [
      {
        MetricName: 'MigrationDuration',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Version', Value: migration.version },
          { Name: 'Environment', Value: this.context.environment }
        ]
      },
      {
        MetricName: success ? 'MigrationSuccess' : 'MigrationFailure',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Version', Value: migration.version },
          { Name: 'Environment', Value: this.context.environment }
        ]
      }
    ];

    await this.context.cloudwatch.putMetricData({
      Namespace: this.metricsNamespace,
      MetricData: metrics
    }).promise();
  }

  private async recordMigrationStatus(record: MigrationRecord): Promise<void> {
    await this.context.dynamodb.put({
      TableName: this.migrationsTable,
      Item: record
    }).promise();
  }

  private getMigrationType(migration: Migration): 'dynamodb' | 'sql' {
    return migration.constructor.name.toLowerCase().includes('sql') ? 'sql' : 'dynamodb';
  }

  private async getAffectedTables(migration: Migration): Promise<string[]> {
    // This would be implemented based on migration metadata or parsing
    // For now, return a placeholder
    return ['Tasks', 'Workers', 'Companies', 'Verifications', 'Transactions'];
  }

  private async createPostgresDump(): Promise<Buffer> {
    // This would be implemented using pg_dump
    // For now, return a placeholder
    return Buffer.from('');
  }
} 