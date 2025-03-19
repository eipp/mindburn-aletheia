"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationManager = exports.Migration = void 0;
class Migration {
    constructor(context, version, description) {
        this.context = context;
        this.version = version;
        this.description = description;
    }
}
exports.Migration = Migration;
class MigrationManager {
    constructor(context) {
        this.context = context;
        this.migrationsTable = 'DatabaseMigrations';
        this.backupBucket = 'mindburn-db-backups';
        this.metricsNamespace = 'Mindburn/Migrations';
    }
    async initialize() {
        await this.ensureMigrationsTableExists();
        await this.ensureBackupBucketExists();
    }
    async ensureMigrationsTableExists() {
        try {
            await this.context.dynamodb
                .describeTable({
                TableName: this.migrationsTable,
            })
                .promise();
        }
        catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                await this.createMigrationsTable();
            }
            else {
                throw error;
            }
        }
    }
    async createMigrationsTable() {
        await this.context.dynamodb
            .createTable({
            TableName: this.migrationsTable,
            KeySchema: [{ AttributeName: 'version', KeyType: 'HASH' }],
            AttributeDefinitions: [
                { AttributeName: 'version', AttributeType: 'S' },
                { AttributeName: 'status', AttributeType: 'S' },
                { AttributeName: 'appliedAt', AttributeType: 'N' },
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'StatusIndex',
                    KeySchema: [
                        { AttributeName: 'status', KeyType: 'HASH' },
                        { AttributeName: 'appliedAt', KeyType: 'RANGE' },
                    ],
                    Projection: { ProjectionType: 'ALL' },
                },
            ],
            BillingMode: 'PAY_PER_REQUEST',
        })
            .promise();
    }
    async ensureBackupBucketExists() {
        try {
            await this.context.s3
                .headBucket({
                Bucket: this.backupBucket,
            })
                .promise();
        }
        catch (error) {
            if (error.code === 'NotFound') {
                await this.context.s3
                    .createBucket({
                    Bucket: this.backupBucket,
                    ObjectLockEnabledForBucket: true,
                })
                    .promise();
                await this.context.s3
                    .putBucketVersioning({
                    Bucket: this.backupBucket,
                    VersioningConfiguration: { Status: 'Enabled' },
                })
                    .promise();
            }
            else {
                throw error;
            }
        }
    }
    async applyMigration(migration) {
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
                duration: 0,
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
                duration: Date.now() - startTime,
            });
            // Publish metrics
            await this.publishMetrics(migration, true, Date.now() - startTime);
        }
        catch (error) {
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
                error: error.message,
            });
            // Publish failure metrics
            await this.publishMetrics(migration, false, Date.now() - startTime);
            // Attempt rollback
            await this.rollbackMigration(migration);
            throw error;
        }
    }
    async createBackup(migration) {
        const timestamp = new Date().toISOString();
        const backupKey = `${this.context.environment}/${migration.version}/${timestamp}`;
        if (this.getMigrationType(migration) === 'dynamodb') {
            // Create DynamoDB backup
            const tables = await this.getAffectedTables(migration);
            for (const table of tables) {
                await this.context.dynamodb
                    .createBackup({
                    TableName: table,
                    BackupName: `${backupKey}-${table}`,
                })
                    .promise();
            }
        }
        else {
            // Create PostgreSQL backup
            const dumpFile = await this.createPostgresDump();
            await this.context.s3
                .putObject({
                Bucket: this.backupBucket,
                Key: `${backupKey}-postgres.dump`,
                Body: dumpFile,
            })
                .promise();
        }
    }
    async rollbackMigration(migration) {
        try {
            await migration.down();
            await this.recordMigrationStatus({
                version: migration.version,
                description: migration.description,
                type: this.getMigrationType(migration),
                status: 'rolled_back',
                appliedAt: Date.now(),
                checksum: migration.generateChecksum(),
                duration: 0,
            });
        }
        catch (error) {
            this.context.logger.error('Rollback failed:', error);
            throw new Error(`Migration rollback failed: ${error.message}`);
        }
    }
    async publishMetrics(migration, success, duration) {
        const metrics = [
            {
                MetricName: 'MigrationDuration',
                Value: duration,
                Unit: 'Milliseconds',
                Dimensions: [
                    { Name: 'Version', Value: migration.version },
                    { Name: 'Environment', Value: this.context.environment },
                ],
            },
            {
                MetricName: success ? 'MigrationSuccess' : 'MigrationFailure',
                Value: 1,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Version', Value: migration.version },
                    { Name: 'Environment', Value: this.context.environment },
                ],
            },
        ];
        await this.context.cloudwatch
            .putMetricData({
            Namespace: this.metricsNamespace,
            MetricData: metrics,
        })
            .promise();
    }
    async recordMigrationStatus(record) {
        await this.context.dynamodb
            .put({
            TableName: this.migrationsTable,
            Item: record,
        })
            .promise();
    }
    getMigrationType(migration) {
        return migration.constructor.name.toLowerCase().includes('sql') ? 'sql' : 'dynamodb';
    }
    async getAffectedTables(migration) {
        // This would be implemented based on migration metadata or parsing
        // For now, return a placeholder
        return ['Tasks', 'Workers', 'Companies', 'Verifications', 'Transactions'];
    }
    async createPostgresDump() {
        // This would be implemented using pg_dump
        // For now, return a placeholder
        return Buffer.from('');
    }
}
exports.MigrationManager = MigrationManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIk1pZ3JhdGlvbk1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBd0JBLE1BQXNCLFNBQVM7SUFDN0IsWUFDWSxPQUF5QixFQUN6QixPQUFlLEVBQ2YsV0FBbUI7UUFGbkIsWUFBTyxHQUFQLE9BQU8sQ0FBa0I7UUFDekIsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUNmLGdCQUFXLEdBQVgsV0FBVyxDQUFRO0lBQzVCLENBQUM7Q0FNTDtBQVhELDhCQVdDO0FBRUQsTUFBYSxnQkFBZ0I7SUFLM0IsWUFBb0IsT0FBeUI7UUFBekIsWUFBTyxHQUFQLE9BQU8sQ0FBa0I7UUFKNUIsb0JBQWUsR0FBRyxvQkFBb0IsQ0FBQztRQUN2QyxpQkFBWSxHQUFHLHFCQUFxQixDQUFDO1FBQ3JDLHFCQUFnQixHQUFHLHFCQUFxQixDQUFDO0lBRVYsQ0FBQztJQUVqRCxLQUFLLENBQUMsVUFBVTtRQUNkLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDekMsTUFBTSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBRU8sS0FBSyxDQUFDLDJCQUEyQjtRQUN2QyxJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTtpQkFDeEIsYUFBYSxDQUFDO2dCQUNiLFNBQVMsRUFBRSxJQUFJLENBQUMsZUFBZTthQUNoQyxDQUFDO2lCQUNELE9BQU8sRUFBRSxDQUFDO1FBQ2YsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssMkJBQTJCLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUNyQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFTyxL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LFNBQVMsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCO1FBQzlCLDBDQUEwQztRQUMxQyxnQ0FBZ0M7UUFDaEMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7Q0FDRjtBQTNQRCw0Q0EyUEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQiwgUzMsIENsb3VkV2F0Y2ggfSBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCB7IFBvb2wgfSBmcm9tICdwZyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9Mb2dnZXInO1xuXG5pbnRlcmZhY2UgTWlncmF0aW9uUmVjb3JkIHtcbiAgdmVyc2lvbjogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICB0eXBlOiAnZHluYW1vZGInIHwgJ3NxbCc7XG4gIGFwcGxpZWRBdDogbnVtYmVyO1xuICBzdGF0dXM6ICdwZW5kaW5nJyB8ICdpbl9wcm9ncmVzcycgfCAnY29tcGxldGVkJyB8ICdmYWlsZWQnIHwgJ3JvbGxlZF9iYWNrJztcbiAgY2hlY2tzdW06IHN0cmluZztcbiAgZHVyYXRpb246IG51bWJlcjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBNaWdyYXRpb25Db250ZXh0IHtcbiAgZHluYW1vZGI6IER5bmFtb0RCLkRvY3VtZW50Q2xpZW50O1xuICBwb3N0Z3JlczogUG9vbDtcbiAgczM6IFMzO1xuICBjbG91ZHdhdGNoOiBDbG91ZFdhdGNoO1xuICBsb2dnZXI6IExvZ2dlcjtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1pZ3JhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBjb250ZXh0OiBNaWdyYXRpb25Db250ZXh0LFxuICAgIHByb3RlY3RlZCB2ZXJzaW9uOiBzdHJpbmcsXG4gICAgcHJvdGVjdGVkIGRlc2NyaXB0aW9uOiBzdHJpbmdcbiAgKSB7fVxuXG4gIGFic3RyYWN0IHVwKCk6IFByb21pc2U8dm9pZD47XG4gIGFic3RyYWN0IGRvd24oKTogUHJvbWlzZTx2b2lkPjtcbiAgYWJzdHJhY3QgdmFsaWRhdGUoKTogUHJvbWlzZTxib29sZWFuPjtcbiAgYWJzdHJhY3QgZ2VuZXJhdGVDaGVja3N1bSgpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBNaWdyYXRpb25NYW5hZ2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBtaWdyYXRpb25zVGFibGUgPSAnRGF0YWJhc2VNaWdyYXRpb25zJztcbiAgcHJpdmF0ZSByZWFkb25seSBiYWNrdXBCdWNrZXQgPSAnbWluZGJ1cm4tZGItYmFja3Vwcyc7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWV0cmljc05hbWVzcGFjZSA9ICdNaW5kYnVybi9NaWdyYXRpb25zJztcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbnRleHQ6IE1pZ3JhdGlvbkNvbnRleHQpIHt9XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZU1pZ3JhdGlvbnNUYWJsZUV4aXN0cygpO1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlQmFja3VwQnVja2V0RXhpc3RzKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGVuc3VyZU1pZ3JhdGlvbnNUYWJsZUV4aXN0cygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5jb250ZXh0LmR5bmFtb2RiXG4gICAgICAgIC5kZXNjcmliZVRhYmxlKHtcbiAgICAgICAgICBUYWJsZU5hbWU6IHRoaXMubWlncmF0aW9uc1RhYmxlLFxuICAgICAgICB9KVxuICAgICAgICAucHJvbWlzZSgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IuY29kZSA9PT0gJ1Jlc291cmNlTm90Rm91bmRFeGNlcHRpb24nKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWlncmF0aW9uc1RhYmxlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1pZ3JhdGlvbnNUYWJsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmNvbnRleHQuZHluYW1vZGJcbiAgICAgIC5jcmVhdGVUYWJsZSh7XG4gICAgICAgIFRhYmxlTmFtZTogdGhpcy5taWdyYXRpb25zVGFibGUsXG4gICAgICAgIEtleVNjaGVtYTogW3sgQXR0cmlidXRlTmFtZTogJ3ZlcnNpb24nLCBLZXlUeXBlOiAnSEFTSCcgfV0sXG4gICAgICAgIEF0dHJpYnV0ZURlZmluaXRpb25zOiBbXG4gICAgICAgICAgeyBBdHRyaWJ1dGVOYW1lOiAndmVyc2lvbicsIEF0dHJpYnV0ZVR5cGU6ICdTJyB9LFxuICAgICAgICAgIHsgQXR0cmlidXRlTmFtZTogJ3N0YXR1cycsIEF0dHJpYnV0ZVR5cGU6ICdTJyB9LFxuICAgICAgICAgIHsgQXR0cmlidXRlTmFtZTogJ2FwcGxpZWRBdCcsIEF0dHJpYnV0ZVR5cGU6ICdOJyB9LFxuICAgICAgICBdLFxuICAgICAgICBHbG9iYWxTZWNvbmRhcnlJbmRleGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSW5kZXhOYW1lOiAnU3RhdHVzSW5kZXgnLFxuICAgICAgICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgICAgICAgIHsgQXR0cmlidXRlTmFtZTogJ3N0YXR1cycsIEtleVR5cGU6ICdIQVNIJyB9LFxuICAgICAgICAgICAgICB7IEF0dHJpYnV0ZU5hbWU6ICdhcHBsaWVkQXQnLCBLZXlUeXBlOiAnUkFOR0UnIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgUHJvamVjdGlvbjogeyBQcm9qZWN0aW9uVHlwZTogJ0FMTCcgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBCaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCcsXG4gICAgICB9KVxuICAgICAgLnByb21pc2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZW5zdXJlQmFja3VwQnVja2V0RXhpc3RzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmNvbnRleHQuczNcbiAgICAgICAgLmhlYWRCdWNrZXQoe1xuICAgICAgICAgIEJ1Y2tldDogdGhpcy5iYWNrdXBCdWNrZXQsXG4gICAgICAgIH0pXG4gICAgICAgIC5wcm9taXNlKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvci5jb2RlID09PSAnTm90Rm91bmQnKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY29udGV4dC5zM1xuICAgICAgICAgIC5jcmVhdGVCdWNrZXQoe1xuICAgICAgICAgICAgQnVja2V0OiB0aGlzLmJhY2t1cEJ1Y2tldCxcbiAgICAgICAgICAgIE9iamVjdExvY2tFbmFibGVkRm9yQnVja2V0OiB0cnVlLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnByb21pc2UoKTtcblxuICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQuczNcbiAgICAgICAgICAucHV0QnVja2V0VmVyc2lvbmluZyh7XG4gICAgICAgICAgICBCdWNrZXQ6IHRoaXMuYmFja3VwQnVja2V0LFxuICAgICAgICAgICAgVmVyc2lvbmluZ0NvbmZpZ3VyYXRpb246IHsgU3RhdHVzOiAnRW5hYmxlZCcgfSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5wcm9taXNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyBhcHBseU1pZ3JhdGlvbihtaWdyYXRpb246IE1pZ3JhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc3QgY2hlY2tzdW0gPSBtaWdyYXRpb24uZ2VuZXJhdGVDaGVja3N1bSgpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlY29yZCBtaWdyYXRpb24gc3RhcnRcbiAgICAgIGF3YWl0IHRoaXMucmVjb3JkTWlncmF0aW9uU3RhdHVzKHtcbiAgICAgICAgdmVyc2lvbjogbWlncmF0aW9uLnZlcnNpb24sXG4gICAgICAgIGRlc2NyaXB0aW9uOiBtaWdyYXRpb24uZGVzY3JpcHRpb24sXG4gICAgICAgIHR5cGU6IHRoaXMuZ2V0TWlncmF0aW9uVHlwZShtaWdyYXRpb24pLFxuICAgICAgICBzdGF0dXM6ICdpbl9wcm9ncmVzcycsXG4gICAgICAgIGFwcGxpZWRBdDogc3RhcnRUaW1lLFxuICAgICAgICBjaGVja3N1bSxcbiAgICAgICAgZHVyYXRpb246IDAsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIGJhY2t1cFxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVCYWNrdXAobWlncmF0aW9uKTtcblxuICAgICAgLy8gQXBwbHkgbWlncmF0aW9uXG4gICAgICBhd2FpdCBtaWdyYXRpb24udXAoKTtcblxuICAgICAgLy8gVmFsaWRhdGUgbWlncmF0aW9uXG4gICAgICBjb25zdCBpc1ZhbGlkID0gYXdhaXQgbWlncmF0aW9uLnZhbGlkYXRlKCk7XG4gICAgICBpZiAoIWlzVmFsaWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaWdyYXRpb24gdmFsaWRhdGlvbiBmYWlsZWQnKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVjb3JkIHN1Y2Nlc3NmdWwgY29tcGxldGlvblxuICAgICAgYXdhaXQgdGhpcy5yZWNvcmRNaWdyYXRpb25TdGF0dXMoe1xuICAgICAgICB2ZXJzaW9uOiBtaWdyYXRpb24udmVyc2lvbixcbiAgICAgICAgZGVzY3JpcHRpb246IG1pZ3JhdGlvbi5kZXNjcmlwdGlvbixcbiAgICAgICAgdHlwZTogdGhpcy5nZXRNaWdyYXRpb25UeXBlKG1pZ3JhdGlvbiksXG4gICAgICAgIHN0YXR1czogJ2NvbXBsZXRlZCcsXG4gICAgICAgIGFwcGxpZWRBdDogc3RhcnRUaW1lLFxuICAgICAgICBjaGVja3N1bSxcbiAgICAgICAgZHVyYXRpb246IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gUHVibGlzaCBtZXRyaWNzXG4gICAgICBhd2FpdCB0aGlzLnB1Ymxpc2hNZXRyaWNzKG1pZ3JhdGlvbiwgdHJ1ZSwgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IoJ01pZ3JhdGlvbiBmYWlsZWQ6JywgZXJyb3IpO1xuXG4gICAgICAvLyBSZWNvcmQgZmFpbHVyZVxuICAgICAgYXdhaXQgdGhpcy5yZWNvcmRNaWdyYXRpb25TdGF0dXMoe1xuICAgICAgICB2ZXJzaW9uOiBtaWdyYXRpb24udmVyc2lvbixcbiAgICAgICAgZGVzY3JpcHRpb246IG1pZ3JhdGlvbi5kZXNjcmlwdGlvbixcbiAgICAgICAgdHlwZTogdGhpcy5nZXRNaWdyYXRpb25UeXBlKG1pZ3JhdGlvbiksXG4gICAgICAgIHN0YXR1czogJ2ZhaWxlZCcsXG4gICAgICAgIGFwcGxpZWRBdDogc3RhcnRUaW1lLFxuICAgICAgICBjaGVja3N1bSxcbiAgICAgICAgZHVyYXRpb246IERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFB1Ymxpc2ggZmFpbHVyZSBtZXRyaWNzXG4gICAgICBhd2FpdCB0aGlzLnB1Ymxpc2hNZXRyaWNzKG1pZ3JhdGlvbiwgZmFsc2UsIERhdGUubm93KCkgLSBzdGFydFRpbWUpO1xuXG4gICAgICAvLyBBdHRlbXB0IHJvbGxiYWNrXG4gICAgICBhd2FpdCB0aGlzLnJvbGxiYWNrTWlncmF0aW9uKG1pZ3JhdGlvbik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUJhY2t1cChtaWdyYXRpb246IE1pZ3JhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBiYWNrdXBLZXkgPSBgJHt0aGlzLmNvbnRleHQuZW52aXJvbm1lbnR9LyR7bWlncmF0aW9uLnZlcnNpb259LyR7dGltZXN0YW1wfWA7XG5cbiAgICBpZiAodGhpcy5nZXRNaWdyYXRpb25UeXBlKG1pZ3JhdGlvbikgPT09ICdkeW5hbW9kYicpIHtcbiAgICAgIC8vIENyZWF0ZSBEeW5hbW9EQiBiYWNrdXBcbiAgICAgIGNvbnN0IHRhYmxlcyA9IGF3YWl0IHRoaXMuZ2V0QWZmZWN0ZWRUYWJsZXMobWlncmF0aW9uKTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVzKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY29udGV4dC5keW5hbW9kYlxuICAgICAgICAgIC5jcmVhdGVCYWNrdXAoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZSxcbiAgICAgICAgICAgIEJhY2t1cE5hbWU6IGAke2JhY2t1cEtleX0tJHt0YWJsZX1gLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnByb21pc2UoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIFBvc3RncmVTUUwgYmFja3VwXG4gICAgICBjb25zdCBkdW1wRmlsZSA9IGF3YWl0IHRoaXMuY3JlYXRlUG9zdGdyZXNEdW1wKCk7XG4gICAgICBhd2FpdCB0aGlzLmNvbnRleHQuczNcbiAgICAgICAgLnB1dE9iamVjdCh7XG4gICAgICAgICAgQnVja2V0OiB0aGlzLmJhY2t1cEJ1Y2tldCxcbiAgICAgICAgICBLZXk6IGAke2JhY2t1cEtleX0tcG9zdGdyZXMuZHVtcGAsXG4gICAgICAgICAgQm9keTogZHVtcEZpbGUsXG4gICAgICAgIH0pXG4gICAgICAgIC5wcm9taXNlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByb2xsYmFja01pZ3JhdGlvbihtaWdyYXRpb246IE1pZ3JhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBtaWdyYXRpb24uZG93bigpO1xuXG4gICAgICBhd2FpdCB0aGlzLnJlY29yZE1pZ3JhdGlvblN0YXR1cyh7XG4gICAgICAgIHZlcnNpb246IG1pZ3JhdGlvbi52ZXJzaW9uLFxuICAgICAgICBkZXNjcmlwdGlvbjogbWlncmF0aW9uLmRlc2NyaXB0aW9uLFxuICAgICAgICB0eXBlOiB0aGlzLmdldE1pZ3JhdGlvblR5cGUobWlncmF0aW9uKSxcbiAgICAgICAgc3RhdHVzOiAncm9sbGVkX2JhY2snLFxuICAgICAgICBhcHBsaWVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIGNoZWNrc3VtOiBtaWdyYXRpb24uZ2VuZXJhdGVDaGVja3N1bSgpLFxuICAgICAgICBkdXJhdGlvbjogMCxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKCdSb2xsYmFjayBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBNaWdyYXRpb24gcm9sbGJhY2sgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwdWJsaXNoTWV0cmljcyhcbiAgICBtaWdyYXRpb246IE1pZ3JhdGlvbixcbiAgICBzdWNjZXNzOiBib29sZWFuLFxuICAgIGR1cmF0aW9uOiBudW1iZXJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbWV0cmljcyA9IFtcbiAgICAgIHtcbiAgICAgICAgTWV0cmljTmFtZTogJ01pZ3JhdGlvbkR1cmF0aW9uJyxcbiAgICAgICAgVmFsdWU6IGR1cmF0aW9uLFxuICAgICAgICBVbml0OiAnTWlsbGlzZWNvbmRzJyxcbiAgICAgICAgRGltZW5zaW9uczogW1xuICAgICAgICAgIHsgTmFtZTogJ1ZlcnNpb24nLCBWYWx1ZTogbWlncmF0aW9uLnZlcnNpb24gfSxcbiAgICAgICAgICB7IE5hbWU6ICdFbnZpcm9ubWVudCcsIFZhbHVlOiB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnQgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIE1ldHJpY05hbWU6IHN1Y2Nlc3MgPyAnTWlncmF0aW9uU3VjY2VzcycgOiAnTWlncmF0aW9uRmFpbHVyZScsXG4gICAgICAgIFZhbHVlOiAxLFxuICAgICAgICBVbml0OiAnQ291bnQnLFxuICAgICAgICBEaW1lbnNpb25zOiBbXG4gICAgICAgICAgeyBOYW1lOiAnVmVyc2lvbicsIFZhbHVlOiBtaWdyYXRpb24udmVyc2lvbiB9LFxuICAgICAgICAgIHsgTmFtZTogJ0Vudmlyb25tZW50JywgVmFsdWU6IHRoaXMuY29udGV4dC5lbnZpcm9ubWVudCB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdO1xuXG4gICAgYXdhaXQgdGhpcy5jb250ZXh0LmNsb3Vkd2F0Y2hcbiAgICAgIC5wdXRNZXRyaWNEYXRhKHtcbiAgICAgICAgTmFtZXNwYWNlOiB0aGlzLm1ldHJpY3NOYW1lc3BhY2UsXG4gICAgICAgIE1ldHJpY0RhdGE6IG1ldHJpY3MsXG4gICAgICB9KVxuICAgICAgLnByb21pc2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVjb3JkTWlncmF0aW9uU3RhdHVzKHJlY29yZDogTWlncmF0aW9uUmVjb3JkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5jb250ZXh0LmR5bmFtb2RiXG4gICAgICAucHV0KHtcbiAgICAgICAgVGFibGVOYW1lOiB0aGlzLm1pZ3JhdGlvbnNUYWJsZSxcbiAgICAgICAgSXRlbTogcmVjb3JkLFxuICAgICAgfSlcbiAgICAgIC5wcm9taXNlKCk7XG4gIH1cblxuICBwcml2YXRlIGdldE1pZ3JhdGlvblR5cGUobWlncmF0aW9uOiBNaWdyYXRpb24pOiAnZHluYW1vZGInIHwgJ3NxbCcge1xuICAgIHJldHVybiBtaWdyYXRpb24uY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzcWwnKSA/ICdzcWwnIDogJ2R5bmFtb2RiJztcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0QWZmZWN0ZWRUYWJsZXMobWlncmF0aW9uOiBNaWdyYXRpb24pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgLy8gVGhpcyB3b3VsZCBiZSBpbXBsZW1lbnRlZCBiYXNlZCBvbiBtaWdyYXRpb24gbWV0YWRhdGEgb3IgcGFyc2luZ1xuICAgIC8vIEZvciBub3csIHJldHVybiBhIHBsYWNlaG9sZGVyXG4gICAgcmV0dXJuIFsnVGFza3MnLCAnV29ya2VycycsICdDb21wYW5pZXMnLCAnVmVyaWZpY2F0aW9ucycsICdUcmFuc2FjdGlvbnMnXTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlUG9zdGdyZXNEdW1wKCk6IFByb21pc2U8QnVmZmVyPiB7XG4gICAgLy8gVGhpcyB3b3VsZCBiZSBpbXBsZW1lbnRlZCB1c2luZyBwZ19kdW1wXG4gICAgLy8gRm9yIG5vdywgcmV0dXJuIGEgcGxhY2Vob2xkZXJcbiAgICByZXR1cm4gQnVmZmVyLmZyb20oJycpO1xuICB9XG59XG4iXX0=