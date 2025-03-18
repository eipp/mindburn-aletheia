#!/usr/bin/env node

/**
 * Batch file renaming script for aletheia.mindburn.org project
 * 
 * This script renames files according to the naming conventions defined in docs/refactoring/naming-convention.md
 * It creates a log of all changes made and can be run in dry-run mode to preview changes.
 */

const fs = require('fs');
const path = require('path');

// Configuration options
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'rename-log.json',
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.serverless'
  ]
};

// Rules for transforming filenames
const RENAME_RULES = [
  // Convert kebab-case to camelCase for regular files
  {
    pattern: /(.*?)[-.]([a-z])(.*?)\.([jt]s|json|md)$/,
    test: (filename) => !filename.includes('tsconfig') && 
                        !filename.includes('.config.') && 
                        !filename.endsWith('.test.ts') && 
                        !filename.endsWith('.spec.ts') && 
                        !filename.includes('eslint') &&
                        !/^[A-Z].*\.tsx$/.test(filename),
    transform: (filename) => {
      return filename.replace(/(.*?)[-.]([a-z])(.*?)\.([jt]s|json|md)$/g, 
        (_, start, letter, rest, ext) => `${start}${letter.toUpperCase()}${rest}.${ext}`);
    }
  },
  
  // Ensure React components use PascalCase (*.tsx files)
  {
    pattern: /^[a-z].*\.tsx$/,
    test: (filename) => filename.endsWith('.tsx') && filename[0].toLowerCase() === filename[0],
    transform: (filename) => {
      return filename.charAt(0).toUpperCase() + filename.slice(1);
    }
  },
  
  // Convert config files to lowercase with dashes
  {
    pattern: /[A-Z].*config\.(js|json|ts)$/i,
    test: (filename) => /config\.(js|json|ts)$/i.test(filename) && filename.match(/[A-Z]/),
    transform: (filename) => {
      return filename.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2');
    }
  },
  
  // Convert test file names to match source files
  {
    pattern: /\.spec\.[jt]s$/,
    test: (filename) => filename.endsWith('.spec.js') || filename.endsWith('.spec.ts'),
    transform: (filename) => {
      return filename.replace(/\.spec\.([jt]s)$/, '.test.$1');
    }
  }
];

// Log for recording changes
const renameLog = {
  timestamp: new Date().toISOString(),
  changes: [],
  errors: []
};

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir, excludePaths = []) {
  let results = [];
  
  // Check if directory should be excluded
  if (excludePaths.some(exclude => dir.includes(exclude))) {
    return results;
  }
  
  try {
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat && stat.isDirectory()) {
        // Recursively get files from subdirectories
        results = results.concat(getAllFiles(filePath, excludePaths));
      } else {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
  
  return results;
}

/**
 * Main function to process files
 */
async function main() {
  console.log(`Batch rename script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Get all files, excluding those in CONFIG.exclude
  const files = getAllFiles('.', CONFIG.exclude);
  
  console.log(`Found ${files.length} files to process`);
  
  let changedCount = 0;
  
  // Process each file
  for (const file of files) {
    try {
      const newName = transformFilename(file);
      
      if (newName !== file) {
        changedCount++;
        
        if (CONFIG.verbose) {
          console.log(`${file} -> ${newName}`);
        }
        
        renameLog.changes.push({
          from: file,
          to: newName
        });
        
        if (!CONFIG.dryRun) {
          // Create parent directories if they don't exist
          const dir = path.dirname(newName);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Rename the file
          fs.renameSync(file, newName);
        }
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
      renameLog.errors.push({
        file,
        error: error.message
      });
    }
  }
  
  console.log(`${changedCount} files would be renamed`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(renameLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

/**
 * Apply transformation rules to a filename
 */
function transformFilename(filename) {
  let newName = filename;
  
  for (const rule of RENAME_RULES) {
    if (rule.test(newName)) {
      newName = rule.transform(newName);
    }
  }
  
  return newName;
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 