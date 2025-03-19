#!/usr/bin/env node

/**
 * Copy Package Files Script
 * 
 * This script copies package.json, tsconfig.json, and creates missing index.ts files
 * in the new directories created by the batch rename script.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'copy-files-log.json',
  packagesDir: 'packages',
  filesToCopy: ['package.json', 'tsconfig.json', 'README.md'],
  filesToFix: {
    'package.json': (content, oldDir, newDir) => {
      // Fix the package name
      const json = JSON.parse(content);
      
      // Update the name to match the new directory
      if (json.name && json.name.includes('-')) {
        const parts = json.name.split('/');
        if (parts.length === 2) {
          const scope = parts[0];
          const name = parts[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          json.name = `${scope}/${name}`;
        }
      }
      
      // Ensure the main field exists
      if (!json.main) {
        json.main = 'dist/index.js';
      }
      
      return JSON.stringify(json, null, 2);
    }
  },
  missingIndexContent: `/**
 * Package index file
 * 
 * This file re-exports all public APIs from this package
 */

// Export your public APIs here
`
};

// Mapping of old directory names to new directory names
const OLD_TO_NEW_MAP = {
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

// Log for recording changes
const copyLog = {
  timestamp: new Date().toISOString(),
  copiedFiles: [],
  createdFiles: [],
  fixedFiles: [],
  errors: []
};

/**
 * Copy a file from source to destination with optional transformation
 */
function copyFile(source, destination, oldDir, newDir) {
  try {
    if (!fs.existsSync(source)) {
      if (CONFIG.verbose) {
        console.log(`Source file ${source} does not exist`);
      }
      return false;
    }
    
    let content = fs.readFileSync(source, 'utf8');
    let wasFixed = false;
    
    // Apply transformation if this is a file we need to fix
    const filename = path.basename(source);
    if (CONFIG.filesToFix[filename]) {
      try {
        const originalContent = content;
        content = CONFIG.filesToFix[filename](content, oldDir, newDir);
        
        // Check if the content was actually modified
        if (content !== originalContent) {
          wasFixed = true;
          
          copyLog.fixedFiles.push({
            file: destination
          });
          
          if (CONFIG.verbose) {
            console.log(`Fixed ${destination}`);
          }
        }
      } catch (error) {
        console.error(`Error fixing ${source}:`, error.message);
      }
    }
    
    // Create parent directory if it doesn't exist
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      if (!CONFIG.dryRun) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    if (!CONFIG.dryRun) {
      fs.writeFileSync(destination, content, 'utf8');
    }
    
    return { copied: true, fixed: wasFixed };
  } catch (error) {
    console.error(`Error copying file ${source} to ${destination}:`, error.message);
    copyLog.errors.push({
      source,
      destination,
      error: error.message
    });
    return { copied: false, fixed: false };
  }
}

/**
 * Create a missing index.ts file
 */
function createIndexFile(directory) {
  try {
    const indexFile = path.join(directory, 'src/index.ts');
    
    // Create src directory if it doesn't exist
    const srcDir = path.join(directory, 'src');
    if (!fs.existsSync(srcDir)) {
      if (!CONFIG.dryRun) {
        fs.mkdirSync(srcDir, { recursive: true });
      }
    }
    
    // Skip if index.ts already exists
    if (fs.existsSync(indexFile)) {
      return false;
    }
    
    if (!CONFIG.dryRun) {
      fs.writeFileSync(indexFile, CONFIG.missingIndexContent, 'utf8');
    }
    
    return true;
  } catch (error) {
    console.error(`Error creating index.ts in ${directory}:`, error.message);
    copyLog.errors.push({
      directory,
      error: error.message
    });
    return false;
  }
}

/**
 * Create a minimal package.json if it doesn't exist
 */
function createPackageJson(directory, name) {
  try {
    const packageJsonPath = path.join(directory, 'package.json');
    
    // Skip if package.json already exists
    if (fs.existsSync(packageJsonPath)) {
      return false;
    }
    
    // Create a minimal package.json
    const packageJson = {
      "name": `@mindburn/${name}`,
      "version": "0.1.0",
      "description": `${name} package for Mindburn Aletheia`,
      "main": "dist/index.js",
      "scripts": {
        "build": "tsc",
        "test": "jest",
        "lint": "eslint src --ext .ts"
      }
    };
    
    if (!CONFIG.dryRun) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    }
    
    return true;
  } catch (error) {
    console.error(`Error creating package.json in ${directory}:`, error.message);
    copyLog.errors.push({
      directory,
      error: error.message
    });
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`Copy package files script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  let copiedCount = 0;
  let fixedCount = 0;
  let createdCount = 0;
  
  // Process each package directory
  for (const [oldDir, newDir] of Object.entries(OLD_TO_NEW_MAP)) {
    const oldDirPath = path.join(CONFIG.packagesDir, oldDir);
    const newDirPath = path.join(CONFIG.packagesDir, newDir);
    
    // Skip if old directory doesn't exist
    if (!fs.existsSync(oldDirPath)) {
      console.log(`Skipping ${oldDir} - directory doesn't exist`);
      continue;
    }
    
    console.log(`Processing ${oldDir} -> ${newDir}`);
    
    // Copy files
    for (const file of CONFIG.filesToCopy) {
      const sourceFile = path.join(oldDirPath, file);
      const destFile = path.join(newDirPath, file);
      
      const result = copyFile(sourceFile, destFile, oldDir, newDir);
      
      if (result.copied) {
        copiedCount++;
        
        copyLog.copiedFiles.push({
          from: sourceFile,
          to: destFile,
          fixed: result.fixed
        });
        
        if (CONFIG.verbose) {
          console.log(`Copied ${sourceFile} to ${destFile}`);
        }
        
        if (result.fixed) {
          fixedCount++;
        }
      }
    }
    
    // Create missing package.json if needed
    if (createPackageJson(newDirPath, newDir)) {
      const packageJson = path.join(newDirPath, 'package.json');
      
      copyLog.createdFiles.push(packageJson);
      createdCount++;
      
      if (CONFIG.verbose) {
        console.log(`Created ${packageJson}`);
      }
    }
    
    // Create missing index.ts file
    if (createIndexFile(newDirPath)) {
      const indexFile = path.join(newDirPath, 'src/index.ts');
      
      copyLog.createdFiles.push(indexFile);
      createdCount++;
      
      if (CONFIG.verbose) {
        console.log(`Created ${indexFile}`);
      }
    }
  }
  
  console.log(`Copied ${copiedCount} files`);
  console.log(`Fixed ${fixedCount} files`);
  console.log(`Created ${createdCount} files`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(copyLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 