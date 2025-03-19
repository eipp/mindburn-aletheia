#!/usr/bin/env ts-node

import { handler } from '../packages/infrastructure-tools/src/migration-handler';
import * as yargs from 'yargs';

async function main() {
  // Parse command line arguments
  const argv = yargs
    .option('stage', {
      alias: 's',
      description: 'Deployment stage',
      type: 'string',
      default: process.env.STAGE || 'dev',
    })
    .option('version', {
      alias: 'v',
      description: 'Run a specific migration version',
      type: 'string',
    })
    .option('up', {
      description: 'Run all pending migrations',
      type: 'boolean',
      default: false,
    })
    .option('down', {
      description: 'Rollback the last migration',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .argv;

  // Check for incompatible options
  if (
    (argv.version && argv.up) ||
    (argv.version && argv.down) ||
    (argv.up && argv.down)
  ) {
    console.error('Error: Specify only one of --version, --up, or --down');
    process.exit(1);
  }

  // Default to --up if no option provided
  const event = {
    version: argv.version,
    up: argv.version ? false : argv.up || (!argv.down && !argv.version),
    down: argv.down,
    stage: argv.stage,
  };

  // Set environment variable for the migration handler
  process.env.STAGE = argv.stage;

  console.log(`Running migrations for stage: ${argv.stage}`);
  console.log('Migration options:', {
    version: event.version || 'all pending',
    direction: event.down ? 'down' : 'up',
  });

  try {
    const result = await handler(event);
    
    if (result.statusCode === 200) {
      console.log('Migrations completed successfully');
      const body = JSON.parse(result.body);
      
      if (body.appliedMigrations?.length > 0) {
        console.log('\nApplied migrations:');
        body.appliedMigrations.forEach((migration: any) => {
          console.log(`- ${migration.version}: ${migration.name}`);
        });
      } else {
        console.log('No migrations applied');
      }
    } else {
      console.error('Migration failed:');
      console.error(JSON.parse(result.body).error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error executing migrations:', error);
    process.exit(1);
  }
}

main(); 