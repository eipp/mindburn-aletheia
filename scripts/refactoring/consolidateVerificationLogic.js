#!/usr/bin/env node

/**
 * Verification Logic Consolidation Script
 * 
 * This script identifies and consolidates verification logic into the shared package.
 * It looks for duplicated validation patterns and moves them to packages/shared/src/verification.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'verification-consolidation-log.json',
  sourcePatterns: [
    '**/src/**/*validation*.ts',
    '**/src/**/*validator*.ts',
    '**/src/**/*verify*.ts',
    '**/src/utils/*check*.ts'
  ],
  excludeDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.serverless'
  ],
  targetDir: 'packages/shared/src/verification'
};

// Regular expressions for finding verification patterns
const VERIFICATION_PATTERNS = [
  // Match common validation functions
  /export\s+(const|function)\s+(\w+)(Validate|Validator|Check|Verify).*?\{[\s\S]+?\}/g,
  // Match verification classes
  /export\s+class\s+(\w+)(Validator|Verification).*?\{[\s\S]+?\}/g
];

// Log for recording changes
const migrationLog = {
  timestamp: new Date().toISOString(),
  identifiedFiles: [],
  extractedFunctions: [],
  movedFiles: [],
  errors: []
};

/**
 * Main function
 */
async function main() {
  console.log(`Verification logic consolidation script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Ensure target directory exists
  if (!fs.existsSync(CONFIG.targetDir) && !CONFIG.dryRun) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
    console.log(`Created target directory: ${CONFIG.targetDir}`);
  }
  
  // Find all potential verification files
  let sourceFiles = [];
  for (const pattern of CONFIG.sourcePatterns) {
    const files = glob.sync(pattern, { 
      ignore: CONFIG.excludeDirs.map(dir => `${dir}/**`)
    });
    sourceFiles = [...sourceFiles, ...files];
  }
  
  // Skip files from the shared package
  sourceFiles = sourceFiles.filter(file => !file.startsWith('packages/shared/'));
  
  console.log(`Found ${sourceFiles.length} potential verification files to analyze`);
  
  // Process each file
  for (const sourceFile of sourceFiles) {
    try {
      // Read file content
      const content = fs.readFileSync(sourceFile, 'utf8');
      
      // Check if this is likely a verification file
      let isVerificationFile = false;
      let extractedFunctions = [];
      
      for (const pattern of VERIFICATION_PATTERNS) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          isVerificationFile = true;
          extractedFunctions.push({
            name: match[2] + (match[3] || ''),
            code: match[0]
          });
        }
      }
      
      if (isVerificationFile) {
        migrationLog.identifiedFiles.push(sourceFile);
        migrationLog.extractedFunctions = [
          ...migrationLog.extractedFunctions,
          ...extractedFunctions.map(f => ({ 
            file: sourceFile, 
            name: f.name 
          }))
        ];
        
        if (CONFIG.verbose) {
          console.log(`Identified verification file: ${sourceFile}`);
          console.log(`Found functions: ${extractedFunctions.map(f => f.name).join(', ')}`);
        }
        
        // Create a new file in the target directory
        const fileName = path.basename(sourceFile);
        const packageName = sourceFile.split('/')[1]; // e.g., 'worker-bot'
        const targetFileName = `${packageName}-${fileName}`;
        const targetFile = path.join(CONFIG.targetDir, targetFileName);
        
        // Generate the new file content
        const imports = [
          '/**',
          ` * Consolidated verification logic from ${sourceFile}`,
          ' */',
          '',
          "import { z } from 'zod';", // Common validation library import
          ''
        ].join('\n');
        
        const functionCode = extractedFunctions.map(f => f.code).join('\n\n');
        const newContent = imports + functionCode;
        
        if (!CONFIG.dryRun) {
          fs.writeFileSync(targetFile, newContent, 'utf8');
        }
        
        migrationLog.movedFiles.push({
          from: sourceFile,
          to: targetFile
        });
        
        if (CONFIG.verbose) {
          console.log(`Created consolidated file: ${targetFile}`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${sourceFile}:`, error.message);
      migrationLog.errors.push({
        file: sourceFile,
        error: error.message
      });
    }
  }
  
  console.log(`Identified ${migrationLog.identifiedFiles.length} verification files`);
  console.log(`Extracted ${migrationLog.extractedFunctions.length} verification functions`);
  console.log(`Created ${migrationLog.movedFiles.length} consolidated files in the shared package`);
  
  // Create an index file
  if (migrationLog.movedFiles.length > 0 && !CONFIG.dryRun) {
    const indexContent = [
      '/**',
      ' * Index file for consolidated verification logic',
      ' */',
      '',
      ...migrationLog.movedFiles.map(file => {
        const fileName = path.basename(file.to, '.ts');
        return `export * from './${fileName}';`;
      }),
      ''
    ].join('\n');
    
    fs.writeFileSync(path.join(CONFIG.targetDir, 'index.ts'), indexContent, 'utf8');
    console.log('Created index file for consolidated verification logic');
  }
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(migrationLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 