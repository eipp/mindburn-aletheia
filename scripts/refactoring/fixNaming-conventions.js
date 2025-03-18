#!/usr/bin/env node
/**
 * Script to fix naming conventions for files and directories
 * 
 * This script will:
 * 1. Rename kebab-case file names to camelCase
 * 2. Rename kebab-case directory names to camelCase (excluding __tests__ directories)
 * 
 * Usage:
 *   node scripts/refactoring/fix-naming-conventions.js --dry-run
 *   node scripts/refactoring/fix-naming-conventions.js --apply
 */

const fs = require('fs');
const path = require('path');

// Configuration
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const PACKAGES_DIR = path.join(WORKSPACE_ROOT, 'packages');
const TEST_DIR_PATTERN = /__tests__/;
const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.github',
  '.vscode',
];

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply = args.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('Error: Please specify either --dry-run or --apply');
  process.exit(1);
}

// Helper functions
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function shouldExcludeDirectory(dirPath) {
  const baseName = path.basename(dirPath);
  return EXCLUDED_DIRS.includes(baseName) || TEST_DIR_PATTERN.test(baseName);
}

function shouldExcludeFile(filePath) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath);
  
  // Only process TypeScript files
  return ext !== '.ts' && ext !== '.tsx' || 
    // Skip index files and d.ts files
    baseName === 'index.ts' || 
    baseName.endsWith('.d.ts') ||
    // Skip files that don't have kebab-case names (already camelCase)
    !baseName.includes('-');
}

function fixNamingConventions(startDir) {
  const filesToRename = [];
  const dirsToRename = [];

  // Helper function to recursively process directories
  function processDirectory(dirPath) {
    // Skip excluded directories
    if (shouldExcludeDirectory(dirPath)) {
      return;
    }

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    // Process files first
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Process subdirectories recursively
        processDirectory(fullPath);
        
        // Check if directory name is kebab-case
        if (entry.name.includes('-')) {
          const newName = kebabToCamel(entry.name);
          dirsToRename.push({
            oldPath: fullPath,
            newPath: path.join(dirPath, newName),
            oldName: entry.name,
            newName
          });
        }
      } else if (entry.isFile()) {
        // Skip files that shouldn't be processed
        if (shouldExcludeFile(fullPath)) {
          continue;
        }
        
        // Check if file name is kebab-case
        const extname = path.extname(entry.name);
        const basename = path.basename(entry.name, extname);
        
        if (basename.includes('-')) {
          const newBasename = kebabToCamel(basename);
          const newName = `${newBasename}${extname}`;
          
          filesToRename.push({
            oldPath: fullPath,
            newPath: path.join(dirPath, newName),
            oldName: entry.name,
            newName
          });
        }
      }
    }
  }

  // Start processing from the specified directory
  processDirectory(startDir);
  
  return { filesToRename, dirsToRename };
}

// Main execution
function main() {
  console.log(`🔍 ${isDryRun ? 'Analyzing' : 'Fixing'} naming conventions...\n`);
  
  // Process each package directory
  const packages = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const pkg of packages) {
    const pkgPath = path.join(PACKAGES_DIR, pkg);
    console.log(`Processing package: ${pkg}`);
    
    const srcPath = path.join(pkgPath, 'src');
    if (!fs.existsSync(srcPath)) {
      console.log(`  Source directory not found, skipping`);
      continue;
    }
    
    const { filesToRename, dirsToRename } = fixNamingConventions(srcPath);
    
    // Log and apply file renames
    if (filesToRename.length > 0) {
      console.log(`  Files to rename (${filesToRename.length}):`);
      for (const { oldPath, newPath, oldName, newName } of filesToRename) {
        const relativePath = path.relative(WORKSPACE_ROOT, oldPath);
        console.log(`    ${relativePath} → ${newName}`);
        
        if (isApply) {
          try {
            // Only rename if file exists
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
            }
          } catch (error) {
            console.error(`Error renaming ${oldPath}: ${error.message}`);
          }
        }
      }
    }
    
    // Sort directories by depth (deepest first) to avoid renaming parent directories first
    const sortedDirsToRename = dirsToRename.sort((a, b) => {
      return b.oldPath.split(path.sep).length - a.oldPath.split(path.sep).length;
    });
    
    // Log and apply directory renames
    if (sortedDirsToRename.length > 0) {
      console.log(`  Directories to rename (${sortedDirsToRename.length}):`);
      for (const { oldPath, newPath, oldName, newName } of sortedDirsToRename) {
        const relativePath = path.relative(WORKSPACE_ROOT, oldPath);
        console.log(`    ${relativePath} → ${newName}`);
        
        if (isApply) {
          try {
            // Only rename if directory exists
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
            }
          } catch (error) {
            console.error(`Error renaming ${oldPath}: ${error.message}`);
          }
        }
      }
    }
    
    if (filesToRename.length === 0 && dirsToRename.length === 0) {
      console.log(`  No naming convention issues found`);
    }
    
    console.log('');
  }
  
  if (isDryRun) {
    console.log(`Dry run completed. Use --apply to apply changes.`);
  } else {
    console.log(`✅ Naming convention fixes applied successfully.`);
  }
}

main(); 