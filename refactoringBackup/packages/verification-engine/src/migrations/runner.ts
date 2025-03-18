import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { createLogger } from '@mindburn/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('MigrationRunner');

interface MigrationMeta {
  id: string;
  name: string;
  executedAt: string;
  duration: number;
}

export class MigrationRunner {
  private readonly migrationsDir: string;
  private readonly migrationsTable: string;

  constructor(
    private readonly dynamodb: DynamoDB,
    private readonly tableName: string
  ) {
    this.migrationsDir = path.join(__dirname);
    this.migrationsTable = `${tableName}-migrations`;
  }

  async initialize() {
    try {
      logger.info('Initializing migrations table');

      await this.dynamodb.createTable({
        TableName: this.migrationsTable,
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });

      logger.info('Migrations table created successfully');
    } catch (error: any) {
      if (error.name === 'ResourceInUseException') {
        logger.info('Migrations table already exists');
        return;
      }
      throw error;
    }
  }

  async getExecutedMigrations(): Promise<MigrationMeta[]> {
    const result = await this.dynamodb.scan({
      TableName: this.migrationsTable
    });

    return (result.Items || []).map(item => ({
      id: item.id.S!,
      name: item.name.S!,
      executedAt: item.executedAt.S!,
      duration: Number(item.duration.N!)
    }));
  }

  async recordMigration(meta: MigrationMeta) {
    await this.dynamodb.putItem({
      TableName: this.migrationsTable,
      Item: {
        id: { S: meta.id },
        name: { S: meta.name },
        executedAt: { S: meta.executedAt },
        duration: { N: meta.duration.toString() }
      }
    });
  }

  async removeMigration(id: string) {
    await this.dynamodb.deleteItem({
      TableName: this.migrationsTable,
      Key: {
        id: { S: id }
      }
    });
  }

  async migrate(direction: 'up' | 'down' = 'up') {
    await this.initialize();

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await fs.readdir(this.migrationsDir);

    const migrations = migrationFiles
      .filter(file => file.endsWith('.ts') && !file.includes('runner'))
      .sort();

    if (direction === 'up') {
      for (const file of migrations) {
        const id = path.parse(file).name;
        if (!executedMigrations.find(m => m.id === id)) {
          await this.runMigration(file, 'up');
        }
      }
    } else {
      for (const file of migrations.reverse()) {
        const id = path.parse(file).name;
        if (executedMigrations.find(m => m.id === id)) {
          await this.runMigration(file, 'down');
        }
      }
    }
  }

  private async runMigration(file: string, direction: 'up' | 'down') {
    const start = Date.now();
    const id = path.parse(file).name;

    try {
      logger.info(`Running migration ${direction}`, { file });

      const migration = require(path.join(this.migrationsDir, file));
      await migration[direction](this.dynamodb, this.tableName);

      const duration = Date.now() - start;

      if (direction === 'up') {
        await this.recordMigration({
          id,
          name: file,
          executedAt: new Date().toISOString(),
          duration
        });
      } else {
        await this.removeMigration(id);
      }

      logger.info(`Migration ${direction} completed`, {
        file,
        duration: `${duration}ms`
      });
    } catch (error) {
      logger.error(`Migration ${direction} failed`, { error, file });
      throw error;
    }
  }
} 