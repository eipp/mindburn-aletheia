#!/usr/bin/env node
import { Command } from 'commander';
import { DynamoDB, S3, CloudWatch } from 'aws-sdk';
import { Pool } from 'pg';
import { Logger } from '../src/utils/Logger';
import { MigrationManager } from '../infrastructure/migrations/MigrationManager';
import glob from 'glob';
import path from 'path';

const program = new Command();

interface Config {
  environment: string;
  dynamodbEndpoint?: string;
  postgresConnection: string;
  region: string;
}

async function loadConfig(): Promise<Config> {
  const env = process.env.NODE_ENV || 'development';
  const config = require(`../config/${env}.json`);
  return config.database;
}

async function createContext(config: Config) {
  const dynamodb = new DynamoDB.DocumentClient({
    endpoint: config.dynamodbEndpoint,
    region: config.region,
  });

  const postgres = new Pool({
    connectionString: config.postgresConnection,
  });

  const s3 = new S3({ region: config.region });
  const cloudwatch = new CloudWatch({ region: config.region });
  const logger = new Logger();

  return {
    dynamodb,
    postgres,
    s3,
    cloudwatch,
    logger,
    environment: config.environment,
  };
}

async function loadMigrations(migrationsDir: string) {
  const files = glob.sync('**/*.ts', { cwd: migrationsDir });
  const migrations = [];

  for (const file of files) {
    const { default: MigrationClass } = await import(path.join(migrationsDir, file));
    migrations.push(MigrationClass);
  }

  return migrations.sort((a, b) => {
    const versionA = a.name.match(/^\d+/)[0];
    const versionB = b.name.match(/^\d+/)[0];
    return parseInt(versionA) - parseInt(versionB);
  });
}

program
  .name('migrate')
  .description('Database migration tool for Mindburn Aletheia')
  .version('1.0.0');

program
  .command('plan')
  .description('Generate migration plan')
  .action(async () => {
    try {
      const config = await loadConfig();
      const context = await createContext(config);
      const manager = new MigrationManager(context);

      await manager.initialize();

      const migrations = await loadMigrations(path.join(__dirname, '../infrastructure/migrations'));
      const plan = await manager.generatePlan(migrations);

      console.log('Migration Plan:');
      plan.forEach(migration => {
        console.log(`- ${migration.version}: ${migration.description}`);
      });
    } catch (error) {
      console.error('Failed to generate migration plan:', error);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Apply pending migrations')
  .option('-f, --force', 'Force apply without confirmation')
  .action(async options => {
    try {
      const config = await loadConfig();
      const context = await createContext(config);
      const manager = new MigrationManager(context);

      await manager.initialize();

      const migrations = await loadMigrations(path.join(__dirname, '../infrastructure/migrations'));
      const plan = await manager.generatePlan(migrations);

      if (plan.length === 0) {
        console.log('No pending migrations.');
        return;
      }

      if (!options.force) {
        console.log('The following migrations will be applied:');
        plan.forEach(migration => {
          console.log(`- ${migration.version}: ${migration.description}`);
        });

        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise(resolve => {
          readline.question('Do you want to continue? (y/N) ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() !== 'y') {
          console.log('Migration cancelled.');
          return;
        }
      }

      for (const MigrationClass of plan) {
        const migration = new MigrationClass(context);
        console.log(`Applying migration ${migration.version}...`);
        await manager.applyMigration(migration);
        console.log('Migration completed successfully.');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify applied migrations')
  .action(async () => {
    try {
      const config = await loadConfig();
      const context = await createContext(config);
      const manager = new MigrationManager(context);

      await manager.initialize();

      const migrations = await loadMigrations(path.join(__dirname, '../infrastructure/migrations'));
      const results = await manager.verifyMigrations(migrations);

      console.log('Verification Results:');
      results.forEach(result => {
        const status = result.valid ? '✓' : '✗';
        console.log(`${status} ${result.version}: ${result.description}`);
        if (!result.valid) {
          console.log(`  Error: ${result.error}`);
        }
      });

      if (results.some(r => !r.valid)) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback last migration')
  .option('-a, --all', 'Rollback all migrations')
  .option('-t, --to <version>', 'Rollback to specific version')
  .action(async options => {
    try {
      const config = await loadConfig();
      const context = await createContext(config);
      const manager = new MigrationManager(context);

      await manager.initialize();

      if (options.all) {
        await manager.rollbackAll();
      } else if (options.to) {
        await manager.rollbackTo(options.to);
      } else {
        await manager.rollbackLast();
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    }
  });

program.parse();
