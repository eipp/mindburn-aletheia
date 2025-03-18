#!/usr/bin/env node

/**
 * Fix Dependencies Script
 * 
 * This script resolves circular dependencies between packages by updating package.json files.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  packagesDir: 'packages',
  logFile: 'dependencies-fix-log.json'
};

// Mapping of package names to their dependencies
const packageDeps = {};
// Log for recording changes
const fixLog = {
  timestamp: new Date().toISOString(),
  updatedFiles: [],
  errors: []
};

/**
 * Get all packages in the workspace
 */
function getPackages() {
  const packagesDir = path.join(process.cwd(), CONFIG.packagesDir);
  return fs.readdirSync(packagesDir)
    .filter(dir => fs.statSync(path.join(packagesDir, dir)).isDirectory())
    .filter(dir => fs.existsSync(path.join(packagesDir, dir, 'package.json')));
}

/**
 * Read package.json for a package
 */
function readPackageJson(packageName) {
  const packagePath = path.join(process.cwd(), CONFIG.packagesDir, packageName, 'package.json');
  try {
    const content = fs.readFileSync(packagePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading package.json for ${packageName}:`, error.message);
    return null;
  }
}

/**
 * Write package.json for a package
 */
function writePackageJson(packageName, content) {
  const packagePath = path.join(process.cwd(), CONFIG.packagesDir, packageName, 'package.json');
  try {
    fs.writeFileSync(packagePath, JSON.stringify(content, null, 2), 'utf8');
    fixLog.updatedFiles.push(packagePath);
    return true;
  } catch (error) {
    console.error(`Error writing package.json for ${packageName}:`, error.message);
    fixLog.errors.push({
      package: packageName,
      error: error.message
    });
    return false;
  }
}

/**
 * Find circular dependencies
 */
function findCircularDependencies() {
  const circularDeps = [];
  
  // Build dependency graph
  Object.keys(packageDeps).forEach(pkg => {
    const deps = packageDeps[pkg];
    
    // Skip if no dependencies
    if (!deps || !deps.length) return;
    
    // Check each dependency
    deps.forEach(dep => {
      // Skip non-workspace dependencies
      if (!packageDeps[dep]) return;
      
      // Check if dependency depends on package
      if (packageDeps[dep] && packageDeps[dep].includes(pkg)) {
        circularDeps.push({
          package1: pkg,
          package2: dep
        });
      }
    });
  });
  
  return circularDeps;
}

/**
 * Fix circular dependencies
 */
function fixCircularDependencies(circularDeps) {
  console.log(`Found ${circularDeps.length} circular dependencies`);
  
  // Process each circular dependency
  circularDeps.forEach(({ package1, package2 }) => {
    console.log(`Fixing circular dependency between ${package1} and ${package2}`);
    
    // Get package.json for both packages
    const pkg1Json = readPackageJson(package1);
    const pkg2Json = readPackageJson(package2);
    
    if (!pkg1Json || !pkg2Json) return;
    
    // Determine which dependency to remove
    if (package1 === 'core' || package1 === 'shared') {
      // Remove dependency on package1 from package2
      removeDependency(pkg2Json, `@mindburn/${package1}`);
      writePackageJson(package2, pkg2Json);
    } else if (package2 === 'core' || package2 === 'shared') {
      // Remove dependency on package2 from package1
      removeDependency(pkg1Json, `@mindburn/${package2}`);
      writePackageJson(package1, pkg1Json);
    } else {
      // Remove dependency on package1 from package2
      removeDependency(pkg2Json, `@mindburn/${package1}`);
      writePackageJson(package2, pkg2Json);
    }
  });
}

/**
 * Remove a dependency from package.json
 */
function removeDependency(packageJson, depName) {
  if (packageJson.dependencies && packageJson.dependencies[depName]) {
    delete packageJson.dependencies[depName];
    return true;
  }
  
  if (packageJson.devDependencies && packageJson.devDependencies[depName]) {
    delete packageJson.devDependencies[depName];
    return true;
  }
  
  if (packageJson.peerDependencies && packageJson.peerDependencies[depName]) {
    delete packageJson.peerDependencies[depName];
    return true;
  }
  
  return false;
}

/**
 * Fix missing dependencies
 */
function fixMissingDependencies() {
  // Get all packages
  const packages = getPackages();
  
  // Process each package
  packages.forEach(pkg => {
    const packageJson = readPackageJson(pkg);
    
    if (!packageJson) return;
    
    let modified = false;
    
    // Ensure dependencies exists
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
      modified = true;
    }
    
    // Add dependency on shared for all packages except shared itself
    if (pkg !== 'shared' && !packageJson.dependencies['@mindburn/shared']) {
      packageJson.dependencies['@mindburn/shared'] = "^0.1.0";
      modified = true;
    }
    
    // Fix incorrect dependency names
    Object.keys(packageJson.dependencies || {}).forEach(dep => {
      // Fix dependencies pointing to old kebab-case package names
      if (dep.startsWith('@') && dep.includes('-')) {
        const parts = dep.split('/');
        const scope = parts[0];
        const name = parts[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        const newDep = `${scope}/${name}`;
        
        if (dep !== newDep) {
          packageJson.dependencies[newDep] = packageJson.dependencies[dep];
          delete packageJson.dependencies[dep];
          modified = true;
        }
      }
    });
    
    // Write package.json if modified
    if (modified) {
      writePackageJson(pkg, packageJson);
    }
  });
}

/**
 * Main function
 */
async function main() {
  console.log('Fixing dependencies...');
  
  // Get all packages
  const packages = getPackages();
  console.log(`Found ${packages.length} packages`);
  
  // Build dependency map
  packages.forEach(pkg => {
    const packageJson = readPackageJson(pkg);
    
    if (!packageJson) return;
    
    // Get all workspace dependencies
    const deps = [];
    Object.keys(packageJson.dependencies || {}).forEach(dep => {
      if (dep.startsWith('@mindburn/')) {
        const depName = dep.replace('@mindburn/', '');
        if (packages.includes(depName)) {
          deps.push(depName);
        }
      }
    });
    
    packageDeps[pkg] = deps;
  });
  
  // Find and fix circular dependencies
  const circularDeps = findCircularDependencies();
  fixCircularDependencies(circularDeps);
  
  // Fix missing dependencies
  fixMissingDependencies();
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(fixLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
  console.log(`Updated ${fixLog.updatedFiles.length} files`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 