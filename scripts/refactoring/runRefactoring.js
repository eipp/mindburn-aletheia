#!/usr/bin/env node

/**
 * Complete Refactoring Script
 * 
 * This script runs all refactoring steps in sequence to ensure a complete refactoring process.
 * It will execute each step and validate the results before proceeding.
 */

const { execSync } = require('child_process');
const readline = require('readline');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  skipPrompts: process.argv.includes('--no-prompts'),
  steps: [
    {
      name: 'Rename Files',
      command: 'node scripts/refactoring/batchRename.js',
      dryRunCommand: 'node scripts/refactoring/batchRename.js --dry-run --verbose',
      description: 'Renaming files according to naming conventions'
    },
    {
      name: 'Validate Refactoring',
      command: 'node scripts/refactoring/validateRefactoring.js',
      dryRunCommand: null, // Always run validation even in dry-run mode
      description: 'Validating that the refactoring process has maintained functionality'
    }
  ]
};

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Execute a command and return the result
 */
function execCommand(command) {
  console.log(`\nExecuting: ${command}\n`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    
    return {
      success: true,
      output
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Prompt the user for confirmation
 */
function promptUser(message) {
  return new Promise((resolve) => {
    if (CONFIG.skipPrompts) {
      console.log(`${message} [Skipping prompt, proceeding automatically]`);
      resolve(true);
      return;
    }
    
    rl.question(`${message} (y/n): `, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log(`File Renaming Refactoring Script - ${CONFIG.dryRun ? 'DRY RUN MODE' : 'LIVE MODE'}`);
  console.log('This script will run the file renaming step and validation.\n');
  
  // Create backup if not in dry-run mode
  if (!CONFIG.dryRun) {
    console.log('Creating backup before proceeding...');
    execCommand('mkdir -p refactoring-backup');
    execCommand('cp -r packages refactoring-backup/packages');
    console.log('Backup created in refactoring-backup/ directory');
  }
  
  // Run each step in sequence
  for (let i = 0; i < CONFIG.steps.length; i++) {
    const step = CONFIG.steps[i];
    console.log(`\n===== Step ${i + 1}/${CONFIG.steps.length}: ${step.name} =====`);
    console.log(step.description);
    
    const command = CONFIG.dryRun && step.dryRunCommand ? step.dryRunCommand : step.command;
    
    // Always ask before proceeding with a step that will make changes
    if (!CONFIG.dryRun) {
      const proceed = await promptUser(`Ready to proceed with ${step.name}?`);
      if (!proceed) {
        console.log(`Skipping ${step.name}`);
        continue;
      }
    }
    
    // Execute the command
    const result = execCommand(command);
    
    if (!result.success) {
      console.error(`Error executing ${step.name}: ${result.error}`);
      
      // If not in dry-run mode, offer to restore from backup or continue anyway
      if (!CONFIG.dryRun) {
        const restore = await promptUser('Restore from backup and exit?');
        if (restore) {
          console.log('Restoring from backup...');
          execCommand('rm -rf packages');
          execCommand('cp -r refactoring-backup/packages packages');
          console.log('Backup restored. Exiting...');
          process.exit(1);
        }
        
        const skipStep = await promptUser('Continue to next step anyway?');
        if (!skipStep) {
          console.log('Exiting refactoring process.');
          process.exit(1);
        }
      }
    } else {
      console.log(`✅ ${step.name} completed successfully.`);
    }
  }
  
  // Final summary
  console.log('\n===== File Renaming Complete =====');
  console.log(`Mode: ${CONFIG.dryRun ? 'DRY RUN (no changes were made)' : 'LIVE'}`);
  
  if (!CONFIG.dryRun) {
    console.log('\n📋 Next Steps:');
    console.log('1. Review the changes and fix any remaining issues');
    console.log('2. Run tests to ensure everything works as expected');
    console.log('3. Commit the changes to version control');
    console.log('\nBackup of the original code is available in refactoring-backup/ directory');
  } else {
    console.log('\n📋 To apply the changes, run this script without the --dry-run flag:');
    console.log('node scripts/refactoring/runRefactoring.js');
  }
  
  rl.close();
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 