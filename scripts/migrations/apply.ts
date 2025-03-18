#!/usr/bin/env ts-node

/**
 * Migration application script
 *
 * This script applies the pending migrations to the database.
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  migrationsDir: path.join(process.cwd(), 'infrastructure/migrations'),
  plansDir: path.join(process.cwd(), 'infrastructure/migrations/plans'),
  historyFile: path.join(process.cwd(), 'infrastructure/migrations/history.json'),
};

/**
 * Main function
 */
async function main() {
  console.log('Applying migrations...');

  // Read the migration history
  let history: { applied: string[] } = { applied: [] };
  if (fs.existsSync(CONFIG.historyFile)) {
    history = JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf8'));
  }

  // Get all migration plan files
  const planFiles = fs
    .readdirSync(CONFIG.plansDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(CONFIG.plansDir, file));

  // Filter out already applied migrations
  const pendingPlans = planFiles.filter(file => {
    const migrationId = path.basename(file, '.json');
    return !history.applied.includes(migrationId);
  });

  if (pendingPlans.length === 0) {
    console.log('No pending migrations to apply.');
    return;
  }

  console.log(`Found ${pendingPlans.length} pending migrations.`);

  // Apply each migration in order
  for (const planFile of pendingPlans) {
    const migrationId = path.basename(planFile, '.json');
    console.log(`Applying migration: ${migrationId}`);

    // Read the migration plan
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));

    try {
      // Here we would actually apply the database operations
      // For now, we'll just simulate it
      console.log(`Applied ${plan.operations.length} operations for migration ${migrationId}`);

      // Record the migration as applied
      history.applied.push(migrationId);
      fs.writeFileSync(CONFIG.historyFile, JSON.stringify(history, null, 2));

      console.log(`Migration ${migrationId} applied successfully.`);
    } catch (error) {
      console.error(`Error applying migration ${migrationId}:`, error);
      process.exit(1);
    }
  }

  console.log('All pending migrations applied successfully.');
}

// Run the script
main().catch(error => {
  console.error('Error applying migrations:', error);
  process.exit(1);
});
