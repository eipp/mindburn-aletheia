import { DynamoDB, S3, CloudWatch } from 'aws-sdk';
import { Pool } from 'pg';
import { Logger } from '../utils/Logger';
interface MigrationContext {
    dynamodb: DynamoDB.DocumentClient;
    postgres: Pool;
    s3: S3;
    cloudwatch: CloudWatch;
    logger: Logger;
    environment: string;
}
export declare abstract class Migration {
    protected context: MigrationContext;
    protected version: string;
    protected description: string;
    constructor(context: MigrationContext, version: string, description: string);
    abstract up(): Promise<void>;
    abstract down(): Promise<void>;
    abstract validate(): Promise<boolean>;
    abstract generateChecksum(): string;
}
export declare class MigrationManager {
    private context;
    private readonly migrationsTable;
    private readonly backupBucket;
    private readonly metricsNamespace;
    constructor(context: MigrationContext);
    initialize(): Promise<void>;
    private ensureMigrationsTableExists;
    private createMigrationsTable;
    private ensureBackupBucketExists;
    applyMigration(migration: Migration): Promise<void>;
    private createBackup;
    private rollbackMigration;
    private publishMetrics;
    private recordMigrationStatus;
    private getMigrationType;
    private getAffectedTables;
    private createPostgresDump;
}
export {};
