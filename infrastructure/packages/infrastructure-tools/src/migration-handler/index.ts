import { DynamoDB, S3, CloudWatch } from 'aws-sdk';
import * as path from 'path';
import * as fs from 'fs';
import { MigrationManager, Migration } from '../../../migrations/MigrationManager';
import { Logger } from '../../../utils/Logger';

// Configure AWS SDK
const dynamodb = new DynamoDB.DocumentClient();
const s3 = new S3();
const cloudwatch = new CloudWatch();

// Set up logger
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  service: 'migration-handler',
});

// Create migration context
const migrationContext = {
  dynamodb,
  s3,
  cloudwatch,
  logger,
  environment: process.env.STAGE || 'dev',
  postgres: null, // We're only dealing with DynamoDB migrations here
};

// Initialize migration manager
const migrationManager = new MigrationManager(migrationContext);

/**
 * Load migrations from the migration directory
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, '../../../migrations/dynamodb');
  
  try {
    const files = fs.readdirSync(migrationsDir);
    const migrationFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    const migrations: Migration[] = [];
    
    for (const file of migrationFiles) {
      try {
        const filePath = path.join(migrationsDir, file);
        
        // Import the migration class
        // For deployment, we'll use the compiled JS files
        const migrationModule = require(filePath);
        
        // Get the class name (assumed to be the only export or the default export)
        const className = Object.keys(migrationModule)[0];
        const MigrationClass = migrationModule[className];
        
        if (MigrationClass && typeof MigrationClass === 'function') {
          // Extract version from filename (e.g., 202502281_AddWorkerSkillsGSI.ts -> 202502281)
          const version = file.split('_')[0];
          
          // Create migration instance
          const migration = new MigrationClass(migrationContext, version, className);
          migrations.push(migration);
        }
      } catch (error) {
        logger.error(`Failed to load migration from file ${file}:`, error);
      }
    }
    
    // Sort migrations by version
    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  } catch (error) {
    logger.error('Failed to load migrations:', error);
    return [];
  }
}

/**
 * Lambda handler for running migrations
 */
export async function handler(event: any): Promise<any> {
  try {
    logger.info('Starting migrations', { event });
    
    // Initialize migration infrastructure
    await migrationManager.initialize();
    
    // Load migrations
    const migrations = await loadMigrations();
    logger.info(`Loaded ${migrations.length} migrations`);
    
    // Determine which migrations to run based on the event
    let migrationsToRun = migrations;
    
    if (event.version) {
      // Run a specific migration
      migrationsToRun = migrations.filter(m => m.version === event.version);
      
      if (migrationsToRun.length === 0) {
        throw new Error(`Migration with version ${event.version} not found`);
      }
    } else if (event.up) {
      // Run all pending migrations
      // Migrations that are already applied will be skipped by the migration manager
    } else if (event.down) {
      // Run a rollback
      const lastMigration = migrations[migrations.length - 1];
      migrationsToRun = [lastMigration];
    }
    
    // Run the migrations
    for (const migration of migrationsToRun) {
      logger.info(`Applying migration ${migration.version}: ${migration.constructor.name}`);
      await migrationManager.applyMigration(migration);
    }
    
    logger.info('Migrations completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Migrations completed successfully',
        appliedMigrations: migrationsToRun.map(m => ({
          version: m.version,
          name: m.constructor.name,
        })),
      }),
    };
  } catch (error) {
    logger.error('Migration failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Migration failed',
        error: error.message,
      }),
    };
  }
} 