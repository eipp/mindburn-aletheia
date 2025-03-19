#!/usr/bin/env node

/**
 * Script Organization Tool
 * 
 * This script organizes the scripts directory by:
 * 1. Creating subdirectories by purpose
 * 2. Moving scripts to appropriate directories
 * 3. Creating README.md files in each directory
 * 
 * Usage:
 *   node scripts/refactoring/organize-scripts.js [--dry-run]
 * 
 * Options:
 *   --dry-run  Show what would be moved without making changes
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Script categories and their descriptions
const categories = {
  'analysis': {
    description: 'Scripts for analyzing the codebase',
    patterns: ['analyze', 'lint', 'audit']
  },
  'build': {
    description: 'Scripts for building the project',
    patterns: ['build', 'compile', 'bundle', 'webpack']
  },
  'deployment': {
    description: 'Scripts for deploying the project',
    patterns: ['deploy', 'publish', 'release']
  },
  'refactoring': {
    description: 'Scripts for refactoring the codebase',
    patterns: ['refactor', 'rename', 'migrate']
  },
  'utils': {
    description: 'Utility scripts',
    patterns: ['util', 'helper', 'generate']
  }
};

// Scripts directory
const scriptsDir = path.resolve('scripts');

// Results tracking
const results = {
  moved: [],
  created: [],
  skipped: []
};

/**
 * Create a directory if it doesn't exist
 */
function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    if (!dryRun) {
      fs.mkdirSync(dir, { recursive: true });
    }
    results.created.push(dir);
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Created directory: ${dir}`);
  }
}

/**
 * Create README.md file in a directory
 */
function createReadme(dir, description, scripts) {
  const readmePath = path.join(dir, 'README.md');
  
  if (fs.existsSync(readmePath)) {
    results.skipped.push(readmePath);
    return;
  }
  
  const content = `# ${path.basename(dir).charAt(0).toUpperCase() + path.basename(dir).slice(1)} Scripts

${description}

## Available Scripts

${scripts.map(script => `### ${path.basename(script)}

\`\`\`
node ${path.relative(process.cwd(), script)}
\`\`\`

`).join('\n')}
`;

  if (!dryRun) {
    fs.writeFileSync(readmePath, content);
  }
  
  results.created.push(readmePath);
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Created README: ${readmePath}`);
}

/**
 * Determine the category for a script
 */
function getScriptCategory(scriptPath) {
  const fileName = path.basename(scriptPath).toLowerCase();
  
  // Skip if already in a category directory
  const parentDir = path.basename(path.dirname(scriptPath));
  if (Object.keys(categories).includes(parentDir)) {
    return null;
  }
  
  // Check if the script matches any category patterns
  for (const [category, info] of Object.entries(categories)) {
    if (info.patterns.some(pattern => fileName.includes(pattern))) {
      return category;
    }
  }
  
  // Default to utils if no match
  return 'utils';
}

/**
 * Move a script to its category directory
 */
function moveScript(scriptPath, category) {
  const targetDir = path.join(scriptsDir, category);
  const targetPath = path.join(targetDir, path.basename(scriptPath));
  
  // Skip if already in the right place
  if (scriptPath === targetPath) {
    results.skipped.push(scriptPath);
    return false;
  }
  
  // Create the target directory if it doesn't exist
  createDirectoryIfNotExists(targetDir);
  
  // Move the file
  if (!dryRun) {
    fs.renameSync(scriptPath, targetPath);
  }
  
  results.moved.push({ from: scriptPath, to: targetPath });
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Moved: ${scriptPath} -> ${targetPath}`);
  return true;
}

/**
 * Process the scripts directory
 */
function processScriptsDirectory() {
  // Get all scripts
  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  
  // Track scripts by category
  const scriptsByCategory = {};
  
  // Process files first
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Skip directories for now
      continue;
    }
    
    // Skip non-script files
    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.ts')) {
      continue;
    }
    
    const scriptPath = path.join(scriptsDir, entry.name);
    const category = getScriptCategory(scriptPath);
    
    if (category) {
      // Initialize category array if needed
      if (!scriptsByCategory[category]) {
        scriptsByCategory[category] = [];
      }
      
      // Move the script
      const moved = moveScript(scriptPath, category);
      
      // Add to category scripts if moved
      if (moved) {
        scriptsByCategory[category].push(path.join(scriptsDir, category, entry.name));
      }
    }
  }
  
  // Now process existing category directories
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    
    const categoryDir = path.join(scriptsDir, entry.name);
    
    // Skip if not a category directory
    if (!Object.keys(categories).includes(entry.name)) {
      continue;
    }
    
    // Get scripts in this category
    const categoryScripts = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(file => !file.isDirectory() && (file.name.endsWith('.js') || file.name.endsWith('.ts')))
      .map(file => path.join(categoryDir, file.name));
    
    // Initialize category array if needed
    if (!scriptsByCategory[entry.name]) {
      scriptsByCategory[entry.name] = [];
    }
    
    // Add scripts to category
    scriptsByCategory[entry.name].push(...categoryScripts);
  }
  
  // Create README.md files for each category
  for (const [category, scripts] of Object.entries(scriptsByCategory)) {
    if (scripts.length > 0) {
      createReadme(
        path.join(scriptsDir, category),
        categories[category].description,
        scripts
      );
    }
  }
}

// Main execution
console.log(`🔄 Organizing scripts directory...`);
console.log(`Mode: ${dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
console.log('');

try {
  processScriptsDirectory();
  
  console.log('\n✅ Organization complete!');
  console.log(`Directories created: ${results.created.filter(path => !path.endsWith('README.md')).length}`);
  console.log(`README files created: ${results.created.filter(path => path.endsWith('README.md')).length}`);
  console.log(`Scripts moved: ${results.moved.length}`);
  console.log(`Items skipped: ${results.skipped.length}`);
  
  if (dryRun) {
    console.log('\nThis was a dry run. No files were actually moved or created.');
    console.log('Run without --dry-run to apply changes.');
  }
} catch (error) {
  console.error('Error during organization process:', error.message);
  process.exit(1);
} 