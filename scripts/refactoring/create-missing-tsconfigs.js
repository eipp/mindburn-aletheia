#!/usr/bin/env node

/**
 * Create Missing TypeScript Configurations
 * 
 * This script creates missing tsconfig.json files for all packages
 * that don't already have one.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES_DIR = path.join(process.cwd(), 'packages');
const TEMPLATE_PATH = path.join(process.cwd(), 'scripts/refactoring/templates/tsconfig.package.json');

// Terminal colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Main function
 */
async function createMissingTsconfigs() {
  console.log(`${BOLD}\n🔧 Creating Missing TypeScript Configurations\n${RESET}`);
  
  // Get all package directories
  const packageDirs = fs.readdirSync(PACKAGES_DIR)
    .filter(name => fs.statSync(path.join(PACKAGES_DIR, name)).isDirectory())
    .map(name => path.join(PACKAGES_DIR, name));
  
  // Get template content
  let templateContent;
  try {
    templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (error) {
    console.error(`${RED}Error reading template:${RESET}`, error.message);
    process.exit(1);
  }
  
  let created = 0;
  let skipped = 0;
  
  // Process each package
  for (const packageDir of packageDirs) {
    const packageName = path.basename(packageDir);
    const tsconfigPath = path.join(packageDir, 'tsconfig.json');
    
    // Skip if tsconfig.json already exists
    if (fs.existsSync(tsconfigPath)) {
      console.log(`${YELLOW}Skipping ${packageName}: tsconfig.json already exists${RESET}`);
      skipped++;
      continue;
    }
    
    // Create tsconfig.json
    try {
      fs.writeFileSync(tsconfigPath, templateContent);
      console.log(`${GREEN}Created tsconfig.json for ${packageName}${RESET}`);
      created++;
    } catch (error) {
      console.error(`${RED}Error creating tsconfig.json for ${packageName}:${RESET}`, error.message);
    }
  }
  
  console.log(`\n${BOLD}Summary:${RESET}`);
  console.log(`${GREEN}Created: ${created}${RESET}`);
  console.log(`${YELLOW}Skipped: ${skipped}${RESET}`);
}

// Run the script
createMissingTsconfigs().catch(error => {
  console.error(`${RED}Error:${RESET}`, error);
  process.exit(1);
}); 