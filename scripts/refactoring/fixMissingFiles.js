#!/usr/bin/env node

/**
 * Fix Missing Files Script
 * 
 * This script creates missing package.json and index.ts files in the new directories.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'fix-missing-files-log.json',
  packagesDir: 'packages'
};

// Mapping of directory names to package names
const PACKAGES = [
  'developerPlatform',
  'paymentSystem',
  'pluginSystem',
  'taskManagement',
  'tokenEconomy',
  'tonContracts',
  'verificationEngine',
  'workerBot',
  'workerCore', 
  'workerInterface',
  'workerWebapp'
];

// Log for recording changes
const fixLog = {
  timestamp: new Date().toISOString(),
  createdFiles: [],
  errors: []
};

/**
 * Create index.ts file
 */
function createIndexFile(pkgDir) {
  const indexContent = `/**
 * Package index file
 * 
 * This file re-exports all public APIs from this package
 */

// Export your public APIs here
`;

  try {
    const srcDir = path.join(pkgDir, 'src');
    const indexFile = path.join(srcDir, 'index.ts');
    
    // Skip if file already exists
    if (fs.existsSync(indexFile)) {
      return false;
    }
    
    // Create src directory if it doesn't exist
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(indexFile, indexContent);
    fixLog.createdFiles.push(indexFile);
    
    return true;
  } catch (error) {
    console.error(`Error creating index.ts file in ${pkgDir}:`, error.message);
    fixLog.errors.push({
      file: path.join(pkgDir, 'src/index.ts'),
      error: error.message
    });
    return false;
  }
}

/**
 * Create package.json file
 */
function createPackageJson(pkgDir, pkgName) {
  const packageJsonContent = {
    "name": `@mindburn/${pkgName}`,
    "version": "0.1.0",
    "description": `${pkgName} package for Mindburn Aletheia`,
    "main": "dist/index.js",
    "scripts": {
      "build": "tsc",
      "test": "jest",
      "lint": "eslint src --ext .ts"
    },
    "dependencies": {
      "@mindburn/shared": "^0.1.0"
    },
    "devDependencies": {
      "@types/jest": "^29.5.12",
      "@types/node": "^20.11.16",
      "jest": "^29.7.0",
      "typescript": "^5.3.3"
    }
  };

  try {
    const packageJsonFile = path.join(pkgDir, 'package.json');
    
    // Skip if file already exists
    if (fs.existsSync(packageJsonFile)) {
      // Read the existing file to check for required fields
      const existingContent = fs.readFileSync(packageJsonFile, 'utf8');
      try {
        const json = JSON.parse(existingContent);
        let needsUpdate = false;
        
        // Make sure name is in the correct format
        if (json.name && json.name.includes('-')) {
          const parts = json.name.split('/');
          if (parts.length === 2) {
            const scope = parts[0];
            const name = parts[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            json.name = `${scope}/${name}`;
            needsUpdate = true;
          }
        }
        
        // Make sure main field exists
        if (!json.main) {
          json.main = 'dist/index.js';
          needsUpdate = true;
        }
        
        // Update if needed
        if (needsUpdate) {
          fs.writeFileSync(packageJsonFile, JSON.stringify(json, null, 2));
          fixLog.createdFiles.push(`${packageJsonFile} (updated)`);
          return true;
        }
      } catch (error) {
        console.error(`Error parsing existing package.json in ${pkgDir}:`, error.message);
      }
      
      return false;
    }
    
    // Write the file
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJsonContent, null, 2));
    fixLog.createdFiles.push(packageJsonFile);
    
    return true;
  } catch (error) {
    console.error(`Error creating package.json file in ${pkgDir}:`, error.message);
    fixLog.errors.push({
      file: path.join(pkgDir, 'package.json'),
      error: error.message
    });
    return false;
  }
}

/**
 * Create tsconfig.json file
 */
function createTsConfig(pkgDir) {
  const tsconfigContent = {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "outDir": "dist",
      "rootDir": "src"
    },
    "include": ["src/**/*"],
    "exclude": ["**/*.test.ts", "**/*.spec.ts", "node_modules", "dist"]
  };

  try {
    const tsconfigFile = path.join(pkgDir, 'tsconfig.json');
    
    // Skip if file already exists
    if (fs.existsSync(tsconfigFile)) {
      return false;
    }
    
    // Write the file
    fs.writeFileSync(tsconfigFile, JSON.stringify(tsconfigContent, null, 2));
    fixLog.createdFiles.push(tsconfigFile);
    
    return true;
  } catch (error) {
    console.error(`Error creating tsconfig.json file in ${pkgDir}:`, error.message);
    fixLog.errors.push({
      file: path.join(pkgDir, 'tsconfig.json'),
      error: error.message
    });
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`Fix missing files script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  if (CONFIG.dryRun) {
    console.log('Running in dry-run mode, no files will be modified');
  }
  
  let createdCount = 0;
  
  // Process each package directory
  for (const pkgName of PACKAGES) {
    const pkgDir = path.join(CONFIG.packagesDir, pkgName);
    
    // Skip if directory doesn't exist
    if (!fs.existsSync(pkgDir)) {
      console.log(`Skipping ${pkgName} - directory doesn't exist`);
      continue;
    }
    
    console.log(`Processing ${pkgName}`);
    
    // Skip if in dry-run mode
    if (CONFIG.dryRun) {
      continue;
    }
    
    // Create or update files
    let created = 0;
    
    if (createPackageJson(pkgDir, pkgName)) {
      created++;
      createdCount++;
    }
    
    if (createTsConfig(pkgDir)) {
      created++;
      createdCount++;
    }
    
    if (createIndexFile(pkgDir)) {
      created++;
      createdCount++;
    }
    
    console.log(`Created/updated ${created} files in ${pkgName}`);
  }
  
  console.log(`Created/updated a total of ${createdCount} files`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(fixLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 