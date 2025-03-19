#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mapping from old to new package names
const dirMapping = {
  'developer-platform': 'developerPlatform',
  'payment-system': 'paymentSystem',
  'plugin-system': 'pluginSystem',
  'task-management': 'taskManagement',
  'token-economy': 'tokenEconomy',
  'ton-contracts': 'tonContracts',
  'verification-engine': 'verificationEngine',
  'worker-bot': 'workerBot',
  'worker-core': 'workerCore',
  'worker-interface': 'workerInterface',
  'worker-webapp': 'workerWebapp'
};

async function removeOldDirectories() {
  const packagesDir = path.join(process.cwd(), 'packages');
  const dirs = await fs.promises.readdir(packagesDir);
  
  for (const [oldDir, newDir] of Object.entries(dirMapping)) {
    const oldPath = path.join(packagesDir, oldDir);
    const newPath = path.join(packagesDir, newDir);
    
    // Check if old directory exists
    if (dirs.includes(oldDir)) {
      // Verify that the new directory exists before removing the old one
      if (dirs.includes(newDir)) {
        try {
          console.log(`Removing old directory: ${oldPath}`);
          // Use rm -rf to forcefully remove directories
          execSync(`rm -rf "${oldPath}"`);
          console.log(`Successfully removed ${oldPath}`);
        } catch (error) {
          console.error(`Error removing directory ${oldPath}:`, error);
        }
      } else {
        console.warn(`New directory ${newPath} does not exist, skipping removal of ${oldPath}`);
      }
    }
  }
}

removeOldDirectories()
  .then(() => {
    console.log('Old directories removal completed.');
  })
  .catch(error => {
    console.error('Error during directories removal:', error);
    process.exit(1);
  }); 