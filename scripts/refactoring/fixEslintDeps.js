#!/usr/bin/env node

/**
 * Fix ESLint Dependencies Script
 * 
 * This script specifically fixes eslint-related dependencies in package.json files.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  packagesDir: 'packages',
  logFile: 'fix-eslint-deps-log.json'
};

// Known problematic ESLint dependencies with their correct names
const ESLINT_CORRECT_NAMES = {
  '@typescript-eslint/eslintPlugin': '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/eslintPluginParser': '@typescript-eslint/parser',
  'eslintConfig': 'eslint-config',
  'eslintPlugin': 'eslint-plugin'
};

// Log for recording changes
const fixLog = {
  timestamp: new Date().toISOString(),
  updatedFiles: [],
  errors: []
};

/**
 * Process a package
 */
function processPackage(pkgName) {
  // Skip if not a directory
  const pkgPath = path.join(process.cwd(), CONFIG.packagesDir, pkgName);
  if (!fs.statSync(pkgPath).isDirectory()) return false;
  
  // Skip if no package.json
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return false;
  
  try {
    // Read package.json
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    let modified = false;
    
    // Fix dependencies
    if (pkgJson.dependencies) {
      const newDeps = {};
      
      // Process each dependency
      Object.entries(pkgJson.dependencies).forEach(([dep, version]) => {
        let newDep = dep;
        
        // Check if this is an ESLint dependency that needs fixing
        for (const [badName, correctName] of Object.entries(ESLINT_CORRECT_NAMES)) {
          if (dep.includes(badName)) {
            newDep = dep.replace(badName, correctName);
            modified = true;
            break;
          }
        }
        
        // Also check and fix partial matches (e.g., eslintPlugin-xyz becomes eslint-plugin-xyz)
        if (newDep === dep && dep.startsWith('@typescript-eslint/') && dep.includes('eslint')) {
          newDep = dep.replace(/eslint([A-Z])/g, 'eslint-$1').toLowerCase();
          modified = true;
        } else if (newDep === dep && dep.includes('eslint')) {
          newDep = dep.replace(/eslint([A-Z])/g, 'eslint-$1').toLowerCase();
          modified = true;
        }
        
        newDeps[newDep] = version;
      });
      
      // Update dependencies
      pkgJson.dependencies = newDeps;
    }
    
    // Fix devDependencies
    if (pkgJson.devDependencies) {
      const newDevDeps = {};
      
      // Process each devDependency
      Object.entries(pkgJson.devDependencies).forEach(([dep, version]) => {
        let newDep = dep;
        
        // Check if this is an ESLint dependency that needs fixing
        for (const [badName, correctName] of Object.entries(ESLINT_CORRECT_NAMES)) {
          if (dep.includes(badName)) {
            newDep = dep.replace(badName, correctName);
            modified = true;
            break;
          }
        }
        
        // Also check and fix partial matches (e.g., eslintPlugin-xyz becomes eslint-plugin-xyz)
        if (newDep === dep && dep.startsWith('@typescript-eslint/') && dep.includes('eslint')) {
          newDep = dep.replace(/eslint([A-Z])/g, 'eslint-$1').toLowerCase();
          modified = true;
        } else if (newDep === dep && dep.includes('eslint')) {
          newDep = dep.replace(/eslint([A-Z])/g, 'eslint-$1').toLowerCase();
          modified = true;
        }
        
        newDevDeps[newDep] = version;
      });
      
      // Update devDependencies
      pkgJson.devDependencies = newDevDeps;
    }
    
    // Write updated package.json
    if (modified) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
      fixLog.updatedFiles.push(pkgJsonPath);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${pkgName}:`, error.message);
    fixLog.errors.push({
      package: pkgName,
      error: error.message
    });
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('Fixing ESLint dependencies...');
  
  // Get all packages
  const packagesDir = path.join(process.cwd(), CONFIG.packagesDir);
  const packages = fs.readdirSync(packagesDir);
  
  console.log(`Found ${packages.length} packages`);
  
  // Process each package
  let updatedCount = 0;
  for (const pkg of packages) {
    if (processPackage(pkg)) {
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} package.json files`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(fixLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 