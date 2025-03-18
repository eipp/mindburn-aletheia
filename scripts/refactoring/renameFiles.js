#!/usr/bin/env node

/**
 * File Renaming Script
 * 
 * This script helps standardize file naming conventions across the codebase:
 * - camelCase for regular files (except React components)
 * - PascalCase for React components, classes, and interfaces
 * - kebab-case for directories
 * 
 * Usage:
 *   node scripts/refactoring/rename-files.js [--dry-run] [--path <path>] [--update-imports]
 * 
 * Options:
 *   --dry-run        Show what would be renamed without making changes
 *   --path           Specify a subdirectory to process (default: entire codebase)
 *   --update-imports Attempt to update imports in files after renaming
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo'
];

const IGNORE_FILES = [
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.env',
  '.env.local'
];

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  path: '.',
  updateImports: args.includes('--update-imports')
};

// Get custom path if specified
const pathIndex = args.indexOf('--path');
if (pathIndex !== -1 && args[pathIndex + 1]) {
  options.path = args[pathIndex + 1];
}

// Results tracking
const results = {
  renamed: [],
  skipped: [],
  errors: []
};

/**
 * Convert string to camelCase
 */
function toCamelCase(str) {
  return str
    .replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^([A-Z])/, (_, letter) => letter.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^([a-z])/, (_, letter) => letter.toUpperCase());
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Determine if a file is a React component
 */
function isReactComponent(filePath) {
  // Check if it's a .tsx or .jsx file
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // Check for React component patterns
      return (
        content.includes('import React') || 
        content.includes('from "react"') || 
        content.includes("from 'react'") ||
        /\bextends React\.Component\b/.test(content) ||
        /\bfunction\s+[A-Z][A-Za-z0-9]*\s*\(/.test(content) ||
        /\bconst\s+[A-Z][A-Za-z0-9]*\s*=/.test(content)
      );
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      return false;
    }
  }
  return false;
}

/**
 * Get the appropriate new name for a file
 */
function getNewName(filePath) {
  const dirName = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const ext = path.extname(filePath);
  const nameWithoutExt = baseName.slice(0, -ext.length);
  
  // Skip if already in the correct format
  if (isReactComponent(filePath)) {
    // React components should be PascalCase
    const pascalName = toPascalCase(nameWithoutExt);
    if (pascalName === nameWithoutExt) {
      return null; // Already in PascalCase
    }
    return path.join(dirName, pascalName + ext);
  } else {
    // Regular files should be camelCase
    const camelName = toCamelCase(nameWithoutExt);
    if (camelName === nameWithoutExt) {
      return null; // Already in camelCase
    }
    return path.join(dirName, camelName + ext);
  }
}

/**
 * Get the appropriate new name for a directory
 */
function getNewDirectoryName(dirPath) {
  const parentDir = path.dirname(dirPath);
  const baseName = path.basename(dirPath);
  
  // Skip if already in the correct format
  const kebabName = toKebabCase(baseName);
  if (kebabName === baseName) {
    return null; // Already in kebab-case
  }
  return path.join(parentDir, kebabName);
}

/**
 * Update imports in a file
 */
function updateImportsInFile(filePath, oldPath, newPath) {
  try {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const oldImportPath = path.basename(oldPath, path.extname(oldPath));
    const newImportPath = path.basename(newPath, path.extname(newPath));
    
    // Skip if the names are the same
    if (oldImportPath === newImportPath) return;
    
    // Replace imports
    const newContent = content.replace(
      new RegExp(`(['"])(.*/)?${oldImportPath}(['"])`, 'g'),
      `$1$2${newImportPath}$3`
    );
    
    if (content !== newContent) {
      if (!options.dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      console.log(`  Updated imports in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error updating imports in ${filePath}:`, error.message);
    results.errors.push({ file: filePath, error: error.message });
  }
}

/**
 * Update imports in all files
 */
function updateAllImports(oldPath, newPath) {
  if (!options.updateImports) return;
  
  console.log(`Updating imports: ${oldPath} -> ${newPath}`);
  
  try {
    // Use grep to find files that import the renamed file
    const grepCommand = `grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "${path.basename(oldPath, path.extname(oldPath))}" .`;
    const grepResult = execSync(grepCommand, { encoding: 'utf8' });
    
    const filesToUpdate = grepResult
      .split('\n')
      .filter(line => line.includes('import ') || line.includes('require('))
      .map(line => line.split(':')[0]);
    
    // Update imports in each file
    for (const file of filesToUpdate) {
      updateImportsInFile(file, oldPath, newPath);
    }
  } catch (error) {
    // grep returns non-zero exit code if no matches found, which is not an error for us
    if (error.status !== 1) {
      console.error('Error finding files to update:', error.message);
      results.errors.push({ file: 'grep', error: error.message });
    }
  }
}

/**
 * Rename a file or directory
 */
function rename(oldPath, newPath) {
  if (!newPath || oldPath === newPath) {
    results.skipped.push(oldPath);
    return;
  }
  
  try {
    if (!options.dryRun) {
      // Create parent directory if it doesn't exist
      const dir = path.dirname(newPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.renameSync(oldPath, newPath);
      
      // Update imports if requested
      if (options.updateImports) {
        updateAllImports(oldPath, newPath);
      }
    }
    
    results.renamed.push({ from: oldPath, to: newPath });
    console.log(`${options.dryRun ? '[DRY RUN] ' : ''}Renamed: ${oldPath} -> ${newPath}`);
  } catch (error) {
    console.error(`Error renaming ${oldPath}:`, error.message);
    results.errors.push({ file: oldPath, error: error.message });
  }
}

/**
 * Process a directory recursively
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  // First, process files
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    if (IGNORE_FILES.includes(entry.name)) continue;
    
    const entryPath = path.join(dir, entry.name);
    
    if (entry.isFile()) {
      const newPath = getNewName(entryPath);
      if (newPath) {
        rename(entryPath, newPath);
      } else {
        results.skipped.push(entryPath);
      }
    }
  }
  
  // Then, process subdirectories
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    
    const entryPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Process files in subdirectory first
      processDirectory(entryPath);
      
      // Then rename the directory itself
      const newPath = getNewDirectoryName(entryPath);
      if (newPath) {
        rename(entryPath, newPath);
      } else {
        results.skipped.push(entryPath);
      }
    }
  }
}

// Main execution
console.log(`🔄 Renaming files to standardize naming conventions...`);
console.log(`Mode: ${options.dryRun ? 'Dry Run (no changes will be made)' : 'Live Run'}`);
console.log(`Path: ${options.path}`);
console.log(`Update Imports: ${options.updateImports ? 'Yes' : 'No'}`);
console.log('');

try {
  processDirectory(path.resolve(options.path));
  
  console.log('\n✅ Renaming complete!');
  console.log(`Files renamed: ${results.renamed.length}`);
  console.log(`Files skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);
  
  if (options.dryRun) {
    console.log('\nThis was a dry run. No files were actually renamed.');
    console.log('Run without --dry-run to apply changes.');
  }
  
  // Write results to file
  const outputDir = path.resolve('docs/analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'rename-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\nDetailed results saved to docs/analysis/rename-results.json`);
} catch (error) {
  console.error('Error during renaming process:', error.message);
  process.exit(1);
} 