#!/usr/bin/env node

/**
 * Fix Package References Script
 * 
 * This script properly fixes references between packages in package.json files.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  packagesDir: 'packages',
  logFile: 'fix-package-refs-log.json'
};

// Log for recording changes
const fixLog = {
  timestamp: new Date().toISOString(),
  updatedFiles: [],
  errors: []
};

/**
 * Fix dependency name
 */
function fixDependencyName(dep) {
  // Skip non-scoped packages
  if (!dep.startsWith('@')) return dep;
  
  // Handle AWS SDK packages explicitly
  if (dep.startsWith('@aws-sdk/')) {
    // Transform camelCase back to kebab-case for AWS SDK
    const parts = dep.split('/');
    const scope = parts[0];
    const name = parts[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return `${scope}/${name}`;
  }
  
  // Handle @types packages
  if (dep.startsWith('@types/')) {
    // Transform camelCase back to kebab-case for types
    const parts = dep.split('/');
    const scope = parts[0];
    const name = parts[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return `${scope}/${name}`;
  }
  
  // Fix kebab-case dependencies for other packages
  if (dep.includes('-')) {
    const parts = dep.split('/');
    const scope = parts[0];
    const name = parts[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return `${scope}/${name}`;
  }
  
  return dep;
}

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
    
    // Fix name field
    if (pkgJson.name && (pkgJson.name.includes('-') || !pkgJson.name.startsWith('@mindburn/'))) {
      const parts = pkgJson.name.split('/');
      const scope = parts.length > 1 ? parts[0] : '@mindburn';
      const name = parts.length > 1 ? parts[1] : parts[0];
      const camelCaseName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      pkgJson.name = `${scope}/${camelCaseName}`;
      modified = true;
    }
    
    // Ensure main field exists
    if (!pkgJson.main) {
      pkgJson.main = 'dist/index.js';
      modified = true;
    }
    
    // Fix dependencies
    if (pkgJson.dependencies) {
      const newDeps = {};
      
      // Process each dependency
      Object.entries(pkgJson.dependencies).forEach(([dep, version]) => {
        // Skip dependency on core
        if (dep === '@mindburn/core') {
          modified = true;
          return;
        }
        
        // Fix AWS SDK and @types dependencies
        if ((dep.startsWith('@aws-sdk/') || dep.startsWith('@types/')) && !dep.includes('-')) {
          const newDep = fixDependencyName(dep);
          newDeps[newDep] = version;
          modified = true;
        }
        // Fix other scoped dependencies
        else if (dep.startsWith('@') && dep.includes('-')) {
          const newDep = fixDependencyName(dep);
          newDeps[newDep] = version;
          modified = true;
        } else {
          newDeps[dep] = version;
        }
      });
      
      // Update dependencies
      pkgJson.dependencies = newDeps;
    }
    
    // Fix devDependencies
    if (pkgJson.devDependencies) {
      const newDevDeps = {};
      
      // Process each devDependency
      Object.entries(pkgJson.devDependencies).forEach(([dep, version]) => {
        if ((dep.startsWith('@aws-sdk/') || dep.startsWith('@types/')) && !dep.includes('-')) {
          const newDep = fixDependencyName(dep);
          newDevDeps[newDep] = version;
          modified = true;
        } else if (dep.startsWith('@') && dep.includes('-')) {
          const newDep = fixDependencyName(dep);
          newDevDeps[newDep] = version;
          modified = true;
        } else {
          newDevDeps[dep] = version;
        }
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
  console.log('Fixing package references...');
  
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