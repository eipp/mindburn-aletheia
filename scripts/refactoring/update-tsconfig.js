#!/usr/bin/env node

/**
 * TypeScript Configuration Update Script
 * 
 * This script updates package-specific tsconfig.json files to extend the base configuration.
 * 
 * Usage:
 *   node scripts/refactoring/update-tsconfig.js [--dry-run] [--package <package-name>]
 * 
 * Options:
 *   --dry-run           Show what would be changed without making changes
 *   --package           Specify a specific package to update (default: all packages)
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  package: null
};

// Get package name if specified
const packageIndex = args.indexOf('--package');
if (packageIndex !== -1 && args[packageIndex + 1]) {
  options.package = args[packageIndex + 1];
}

// Paths
const packagesDir = path.resolve('packages');
const templatesDir = path.resolve('scripts/refactoring/templates');

// Templates
const templates = {
  default: path.join(templatesDir, 'tsconfig.package.json'),
  react: path.join(templatesDir, 'tsconfig.react.json'),
  node: path.join(templatesDir, 'tsconfig.node.json')
};

// Results tracking
const results = {
  updated: [],
  created: [],
  skipped: []
};

/**
 * Determine the template to use for a package
 */
function getTemplateForPackage(packageDir) {
  // Check package.json for dependencies
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Check for React
      if (dependencies.react || dependencies['@types/react']) {
        return templates.react;
      }
      
      // Check for Node.js specific packages
      if (dependencies.express || dependencies.fastify || dependencies['@types/node']) {
        return templates.node;
      }
    } catch (error) {
      console.error(`Error reading package.json for ${path.basename(packageDir)}:`, error.message);
    }
  }
  
  // Default template
  return templates.default;
}

/**
 * Update tsconfig.json for a package
 */
function updateTsConfig(packageDir) {
  const packageName = path.basename(packageDir);
  const tsconfigPath = path.join(packageDir, 'tsconfig.json');
  
  // Get the appropriate template
  const templatePath = getTemplateForPackage(packageDir);
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Check if tsconfig.json exists
  if (fs.existsSync(tsconfigPath)) {
    try {
      const currentConfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      // Skip if already extends the base config
      if (currentConfig.extends === '../../tsconfig.base.json') {
        console.log(`Skipping ${packageName}: Already extends base config`);
        results.skipped.push(packageName);
        return;
      }
      
      // Update the config
      if (!options.dryRun) {
        fs.writeFileSync(tsconfigPath, templateContent);
      }
      
      console.log(`${options.dryRun ? '[DRY RUN] ' : ''}Updated tsconfig.json for ${packageName}`);
      results.updated.push(packageName);
    } catch (error) {
      console.error(`Error updating tsconfig.json for ${packageName}:`, error.message);
    }
  } else {
    // Create new tsconfig.json
    if (!options.dryRun) {
      fs.writeFileSync(tsconfigPath, templateContent);
    }
    
    console.log(`${options.dryRun ? '[DRY RUN] ' : ''}Created tsconfig.json for ${packageName}`);
    results.created.push(packageName);
  }
}

/**
 * Process all packages
 */
function processPackages() {
  // Get all packages
  const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  // Filter to specific package if specified
  const packagesToProcess = options.package
    ? packages.filter(pkg => pkg === options.package)
    : packages;
  
  // Update tsconfig.json for each package
  for (const packageName of packagesToProcess) {
    const packageDir = path.join(packagesDir, packageName);
    updateTsConfig(packageDir);
  }
}

// Main execution
console.log(`🔄 Updating TypeScript configurations...`);
console.log(`Mode: ${options.dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
console.log(`Package: ${options.package || 'All packages'}`);
console.log('');

try {
  // Check if templates exist
  for (const [name, templatePath] of Object.entries(templates)) {
    if (!fs.existsSync(templatePath)) {
      console.error(`Error: Template ${name} not found at ${templatePath}`);
      process.exit(1);
    }
  }
  
  processPackages();
  
  console.log('\n✅ TypeScript configuration update complete!');
  console.log(`Packages updated: ${results.updated.length}`);
  console.log(`Packages with new config: ${results.created.length}`);
  console.log(`Packages skipped: ${results.skipped.length}`);
  
  if (options.dryRun) {
    console.log('\nThis was a dry run. No files were actually changed.');
    console.log('Run without --dry-run to apply changes.');
  }
} catch (error) {
  console.error('Error during TypeScript configuration update:', error.message);
  process.exit(1);
} 