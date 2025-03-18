#!/usr/bin/env node

/**
 * Utility Functions Consolidation Script
 * 
 * This script identifies and consolidates utility functions into the shared package.
 * It looks for duplicated utility functions and moves them to packages/shared/src/utils.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'utils-consolidation-log.json',
  sourcePatterns: [
    '**/src/utils/*.ts',
    '**/src/helpers/*.ts',
    '**/src/common/*.ts',
    '**/src/**/utils/*.ts'
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
  targetDir: 'packages/shared/src/utils',
  utilCategories: {
    format: ['formatter', 'format', 'stringify', 'parse', 'serialize', 'deserialize'],
    time: ['date', 'time', 'duration', 'interval', 'timeout', 'delay'],
    array: ['array', 'collection', 'list', 'set'],
    object: ['object', 'map', 'dict', 'record'],
    string: ['string', 'text', 'regex', 'match'],
    number: ['number', 'math', 'random', 'calc'],
    crypto: ['crypto', 'hash', 'encrypt', 'decrypt', 'sign', 'verify'],
    logger: ['log', 'logger', 'debug', 'trace'],
    network: ['http', 'fetch', 'request', 'api', 'url'],
    file: ['file', 'fs', 'path', 'directory'],
    wait: ['wait', 'sleep', 'delay', 'throttle', 'debounce']
  }
};

// Regular expressions for finding utility functions
const UTIL_PATTERNS = [
  // Match exported functions
  /export\s+(const|function)\s+(\w+)\s*[=\(][\s\S]+?(?:=>|{)[\s\S]+?(?:}|;)(?:\n|$)/g,
  
  // Match utility type definitions
  /export\s+(type|interface)\s+(\w+Util|Utils|Helpers|Helper)\s*=[\s\S]+?(?:;|\})(?:\n|$)/g
];

// Log for recording changes
const migrationLog = {
  timestamp: new Date().toISOString(),
  identifiedFiles: [],
  extractedUtils: [],
  categorizedUtils: {},
  movedFiles: [],
  errors: []
};

/**
 * Categorize a utility function based on its name
 */
function categorizeUtil(name) {
  // Initialize categories if not done yet
  if (!migrationLog.categorizedUtils) {
    migrationLog.categorizedUtils = {};
    for (const category in CONFIG.utilCategories) {
      migrationLog.categorizedUtils[category] = [];
    }
    migrationLog.categorizedUtils.other = [];
  }
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CONFIG.utilCategories)) {
    for (const keyword of keywords) {
      if (name.toLowerCase().includes(keyword.toLowerCase())) {
        migrationLog.categorizedUtils[category].push(name);
        return category;
      }
    }
  }
  
  // If no category matched, put in "other"
  migrationLog.categorizedUtils.other.push(name);
  return 'other';
}

/**
 * Main function
 */
async function main() {
  console.log(`Utility functions consolidation script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Ensure target directory exists
  if (!fs.existsSync(CONFIG.targetDir) && !CONFIG.dryRun) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
    console.log(`Created target directory: ${CONFIG.targetDir}`);
    
    // Create category subdirectories
    for (const category in CONFIG.utilCategories) {
      const categoryDir = path.join(CONFIG.targetDir, category);
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    // Create "other" category directory
    fs.mkdirSync(path.join(CONFIG.targetDir, 'other'), { recursive: true });
  }
  
  // Initialize categorizedUtils
  migrationLog.categorizedUtils = {};
  for (const category in CONFIG.utilCategories) {
    migrationLog.categorizedUtils[category] = [];
  }
  migrationLog.categorizedUtils.other = [];
  
  // Find all potential utility files
  let sourceFiles = [];
  for (const pattern of CONFIG.sourcePatterns) {
    const files = glob.sync(pattern, { 
      ignore: CONFIG.excludeDirs.map(dir => `${dir}/**`)
    });
    sourceFiles = [...sourceFiles, ...files];
  }
  
  // Skip files from the shared package
  sourceFiles = sourceFiles.filter(file => !file.startsWith('packages/shared/'));
  
  console.log(`Found ${sourceFiles.length} potential utility files to analyze`);
  
  // Process each file
  for (const sourceFile of sourceFiles) {
    try {
      // Skip obvious non-utility files
      if (
        sourceFile.includes('config') ||
        sourceFile.includes('types') ||
        sourceFile.includes('constants') ||
        sourceFile.includes('schema')
      ) {
        continue;
      }
      
      // Read file content
      const content = fs.readFileSync(sourceFile, 'utf8');
      
      // Check if this is likely a utility file
      let isUtilFile = false;
      let extractedUtils = [];
      
      for (const pattern of UTIL_PATTERNS) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          isUtilFile = true;
          const utilName = match[2];
          const category = categorizeUtil(utilName);
          
          extractedUtils.push({
            name: utilName,
            code: match[0],
            category
          });
        }
      }
      
      if (isUtilFile && extractedUtils.length > 0) {
        migrationLog.identifiedFiles.push(sourceFile);
        migrationLog.extractedUtils = [
          ...migrationLog.extractedUtils,
          ...extractedUtils.map(u => ({ 
            file: sourceFile, 
            name: u.name,
            category: u.category 
          }))
        ];
        
        if (CONFIG.verbose) {
          console.log(`Identified utility file: ${sourceFile}`);
          console.log(`Found utilities: ${extractedUtils.map(u => u.name).join(', ')}`);
        }
        
        // Group extracted utilities by category
        const utilsByCategory = {};
        for (const util of extractedUtils) {
          if (!utilsByCategory[util.category]) {
            utilsByCategory[util.category] = [];
          }
          utilsByCategory[util.category].push(util);
        }
        
        // Create a file for each category
        for (const [category, utils] of Object.entries(utilsByCategory)) {
          const packageName = sourceFile.split('/')[1]; // e.g., 'worker-bot'
          const fileName = path.basename(sourceFile, '.ts');
          const targetFileName = `${packageName}-${fileName}.ts`;
          const targetSubdir = path.join(CONFIG.targetDir, category);
          const targetFile = path.join(targetSubdir, targetFileName);
          
          // Generate the new file content
          const imports = [
            '/**',
            ` * Consolidated ${category} utilities from ${sourceFile}`,
            ' */',
            '',
            "import { z } from 'zod';", // Add other common imports as needed
            ''
          ].join('\n');
          
          const utilCode = utils.map(u => u.code).join('\n\n');
          const newContent = imports + utilCode;
          
          if (!CONFIG.dryRun) {
            if (!fs.existsSync(targetSubdir)) {
              fs.mkdirSync(targetSubdir, { recursive: true });
            }
            fs.writeFileSync(targetFile, newContent, 'utf8');
          }
          
          migrationLog.movedFiles.push({
            from: sourceFile,
            to: targetFile,
            category
          });
          
          if (CONFIG.verbose) {
            console.log(`Created consolidated ${category} file: ${targetFile}`);
          }
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
  
  console.log(`Identified ${migrationLog.identifiedFiles.length} utility files`);
  console.log(`Extracted ${migrationLog.extractedUtils.length} utility functions`);
  console.log(`Created ${migrationLog.movedFiles.length} consolidated files in the shared package`);
  
  // Create an index file for each category
  if (!CONFIG.dryRun) {
    // First, get all files by category
    const filesByCategory = {};
    for (const file of migrationLog.movedFiles) {
      if (!filesByCategory[file.category]) {
        filesByCategory[file.category] = [];
      }
      filesByCategory[file.category].push(file.to);
    }
    
    // Create an index.ts file for each category with utilities
    for (const [category, files] of Object.entries(filesByCategory)) {
      const categoryDir = path.join(CONFIG.targetDir, category);
      const indexContent = [
        '/**',
        ` * Index file for ${category} utilities`,
        ' */',
        '',
        ...files.map(file => {
          const fileName = path.basename(file, '.ts');
          return `export * from './${fileName}';`;
        }),
        ''
      ].join('\n');
      
      fs.writeFileSync(path.join(categoryDir, 'index.ts'), indexContent, 'utf8');
      console.log(`Created index file for ${category} utilities`);
    }
    
    // Finally, create the main index.ts file
    const mainIndexContent = [
      '/**',
      ' * Main index file for consolidated utilities',
      ' */',
      '',
      ...Object.keys(filesByCategory).map(category => {
        return `export * from './${category}';`;
      }),
      ''
    ].join('\n');
    
    fs.writeFileSync(path.join(CONFIG.targetDir, 'index.ts'), mainIndexContent, 'utf8');
    console.log('Created main index file for consolidated utilities');
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