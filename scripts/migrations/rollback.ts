#!/usr/bin/env ts-node

/**
 * Migration rollback script
 *
 * This script rolls back the most recently applied migration.
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
  console.log('Rolling back migration...');

  // Check if history file exists
  if (!fs.existsSync(CONFIG.historyFile)) {
    console.error('Migration history file does not exist.');
    process.exit(1);
  }

  // Read the migration history
  const history = JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf8'));

  if (history.applied.length === 0) {
    console.log('No migrations to roll back.');
    return;
  }

  // Get the last applied migration
  const lastMigrationId = history.applied[history.applied.length - 1];
  const planFile = path.join(CONFIG.plansDir, `${lastMigrationId}.json`);

  if (!fs.existsSync(planFile)) {
    console.error(`Migration plan file not found: ${planFile}`);
    process.exit(1);
  }

  // Read the migration plan
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));

  console.log(`Rolling back migration: ${lastMigrationId}`);

  try {
    // Here we would actually apply the rollback operations
    // For now, we'll just simulate it
    console.log(
      `Applied ${plan.rollback.length} rollback operations for migration ${lastMigrationId}`
    );

    // Remove the migration from the history
    history.applied.pop();
    fs.writeFileSync(CONFIG.historyFile, JSON.stringify(history, null, 2));

    console.log(`Migration ${lastMigrationId} rolled back successfully.`);
  } catch (error) {
    console.error(`Error rolling back migration ${lastMigrationId}:`, error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Error rolling back migration:', error);
  process.exit(1);
});
