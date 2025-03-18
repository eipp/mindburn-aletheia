#!/usr/bin/env node

/**
 * Test directory consolidation script
 * 
 * This script moves test files into __tests__ directories adjacent to the tested code.
 * It follows the convention of having the test file named the same as the source file with .test.ts suffix.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'test-consolidation-log.json',
  excludeDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.serverless'
  ],
  testPatterns: [
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ]
};

// Log for recording changes
const migrationLog = {
  timestamp: new Date().toISOString(),
  movedFiles: [],
  createdDirs: [],
  errors: []
};

/**
 * Main function
 */
async function main() {
  console.log(`Test consolidation script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Find all test files
  let testFiles = [];
  for (const pattern of CONFIG.testPatterns) {
    const files = glob.sync(pattern, { 
      ignore: CONFIG.excludeDirs.map(dir => `${dir}/**`)
    });
    testFiles = [...testFiles, ...files];
  }
  
  console.log(`Found ${testFiles.length} test files to process`);
  
  // Process each test file
  for (const testFile of testFiles) {
    try {
      // Skip files that are already in __tests__ directories
      if (testFile.includes('__tests__/')) {
        if (CONFIG.verbose) {
          console.log(`Skipping ${testFile} - already in __tests__ directory`);
        }
        continue;
      }
      
      // Get the test file name and determine the source file name
      const testFileName = path.basename(testFile);
      let sourceFileName = testFileName.replace(/\.(test|spec)\.ts$/, '.ts');
      
      // Try to find the source file
      const testDir = path.dirname(testFile);
      let sourceDir = testDir;
      
      // Special case: if the test file is in a test/tests directory, go up one level
      if (testDir.endsWith('/test') || testDir.endsWith('/tests')) {
        sourceDir = path.dirname(testDir);
      }
      
      // Build the target directory path
      const targetDir = path.join(sourceDir, '__tests__');
      
      // Create the target directory if it doesn't exist
      if (!fs.existsSync(targetDir) && !CONFIG.dryRun) {
        fs.mkdirSync(targetDir, { recursive: true });
        migrationLog.createdDirs.push(targetDir);
        
        if (CONFIG.verbose) {
          console.log(`Created directory: ${targetDir}`);
        }
      }
      
      // Normalize test file name to use .test.ts suffix
      const normalizedTestFileName = sourceFileName.replace(/\.ts$/, '.test.ts');
      const targetFile = path.join(targetDir, normalizedTestFileName);
      
      // Move the file
      if (!CONFIG.dryRun) {
        fs.copyFileSync(testFile, targetFile);
        fs.unlinkSync(testFile);
      }
      
      migrationLog.movedFiles.push({
        from: testFile,
        to: targetFile
      });
      
      if (CONFIG.verbose) {
        console.log(`Moved ${testFile} to ${targetFile}`);
      }
    } catch (error) {
      console.error(`Error processing ${testFile}:`, error.message);
      migrationLog.errors.push({
        file: testFile,
        error: error.message
      });
    }
  }
  
  console.log(`Moved ${migrationLog.movedFiles.length} test files to __tests__ directories`);
  console.log(`Created ${migrationLog.createdDirs.length} __tests__ directories`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(migrationLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 