#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Mapping from old to new package names
const packageMap = {
  '@mindburn/developer-platform': '@mindburn/developerPlatform',
  '@mindburn/payment-system': '@mindburn/paymentSystem',
  '@mindburn/plugin-system': '@mindburn/pluginSystem',
  '@mindburn/task-management': '@mindburn/taskManagement',
  '@mindburn/token-economy': '@mindburn/tokenEconomy',
  '@mindburn/ton-contracts': '@mindburn/tonContracts',
  '@mindburn/verification-engine': '@mindburn/verificationEngine',
  '@mindburn/worker-bot': '@mindburn/workerBot',
  '@mindburn/worker-core': '@mindburn/workerCore',
  '@mindburn/worker-interface': '@mindburn/workerInterface',
  '@mindburn/worker-webapp': '@mindburn/workerWebapp'
};

// Function to recursively process files in a directory
async function processDirectory(dirPath) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
        await processDirectory(fullPath);
      }
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
      await processFile(fullPath);
    }
  }
}

// Function to update import paths in a file
async function processFile(filePath) {
  try {
    let content = await fs.promises.readFile(filePath, 'utf8');
    let modified = false;
    
    // Replace imports in the content
    for (const [oldPackage, newPackage] of Object.entries(packageMap)) {
      const oldImportRegex = new RegExp(`['"]${oldPackage}(\\/[^'"]*)?['"]`, 'g');
      const newContent = content.replace(oldImportRegex, (match, subpath) => {
        modified = true;
        return `"${newPackage}${subpath || ''}"`;
      });
      
      if (content !== newContent) {
        content = newContent;
      }
    }
    
    // Save the file if it was modified
    if (modified) {
      console.log(`Updated imports in: ${filePath}`);
      await fs.promises.writeFile(filePath, content, 'utf8');
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

// Main function
async function main() {
  const packagesDir = path.join(process.cwd(), 'packages');
  
  try {
    await processDirectory(packagesDir);
    console.log('Import path updates completed successfully');
  } catch (error) {
    console.error('Error updating import paths:', error);
    process.exit(1);
  }
}

main(); 