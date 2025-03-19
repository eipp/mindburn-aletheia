#!/usr/bin/env node

/**
 * Script to replace console.log usage with proper logger in refactoring scripts
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  scriptsDir: 'scripts/refactoring',
  logFile: 'logs/fix-console-log.json',
};

// Logger implementation for refactoring scripts
const LOGGER_CODE = `
// Logger for refactoring scripts
const logger = {
  info: (message, meta = {}) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    console.log(\`[INFO] \${message}\${metaStr ? ' ' + metaStr : ''}\`);
  },
  error: (message, meta = {}) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    console.error(\`[ERROR] \${message}\${metaStr ? ' ' + metaStr : ''}\`);
  },
  warn: (message, meta = {}) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    console.warn(\`[WARN] \${message}\${metaStr ? ' ' + metaStr : ''}\`);
  },
  debug: (message, meta = {}) => {
    if (process.env.DEBUG) {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      console.log(\`[DEBUG] \${message}\${metaStr ? ' ' + metaStr : ''}\`);
    }
  }
};
`;

// Log tracking
const fixLog = {
  updatedFiles: [],
  skippedFiles: [],
  errors: [],
  timestamp: new Date().toISOString(),
};

/**
 * Process a single file to replace console.log usage with logger
 */
function processFile(filePath) {
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if file already has proper logger usage
    if (content.includes('const logger = {')) {
      fixLog.skippedFiles.push({
        file: filePath,
        reason: 'Already has logger implementation',
      });
      return false;
    }
    
    // Replace console usage with logger
    let newContent = content;
    let hasLoggerImport = false;
    
    // Add logger implementation if needed
    if (content.match(/console\.(log|error|warn|debug)/)) {
      // Insert logger definition after the last require/import or the first line if none
      const importMatch = content.match(/^(const|let|var|import).*require.*;\n/gm);
      
      if (importMatch && importMatch.length > 0) {
        const lastImport = importMatch[importMatch.length - 1];
        const importIndex = content.lastIndexOf(lastImport) + lastImport.length;
        
        newContent = 
          content.substring(0, importIndex) + 
          LOGGER_CODE + 
          content.substring(importIndex);
      } else {
        // Add at the beginning
        newContent = LOGGER_CODE + newContent;
      }
      
      hasLoggerImport = true;
    }
    
    // Replace console.log with logger.info
    newContent = newContent.replace(/console\.log\(\s*[`'"](.*?)['"`](.*?)\)/g, (match, message, args) => {
      // If it has multiple arguments, convert to meta object
      if (args && args.trim()) {
        return `logger.info(\`${message}\`${args})`;
      }
      return `logger.info('${message}')`;
    });
    
    // Replace console.error with logger.error
    newContent = newContent.replace(/console\.error\(\s*[`'"](.*?)['"`](.*?)\)/g, (match, message, args) => {
      if (args && args.trim()) {
        return `logger.error(\`${message}\`${args})`;
      }
      return `logger.error('${message}')`;
    });
    
    // Replace console.warn with logger.warn if exists
    newContent = newContent.replace(/console\.warn\(\s*[`'"](.*?)['"`](.*?)\)/g, (match, message, args) => {
      if (args && args.trim()) {
        return `logger.warn(\`${message}\`${args})`;
      }
      return `logger.warn('${message}')`;
    });
    
    // Check if content changed
    if (newContent !== content && hasLoggerImport) {
      if (!CONFIG.dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      
      fixLog.updatedFiles.push({
        file: filePath,
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    fixLog.errors.push({
      file: filePath,
      error: error.message,
    });
    
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`Fixing console.log usage in refactoring scripts - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Find all JavaScript files in scripts directory
  const scriptsDir = path.join(process.cwd(), CONFIG.scriptsDir);
  const files = glob.sync(`${scriptsDir}/**/*.js`);
  
  console.log(`Found ${files.length} script files`);
  
  // Process each file
  let updatedCount = 0;
  for (const file of files) {
    if (processFile(file)) {
      updatedCount++;
      if (CONFIG.verbose) {
        console.log(`Updated ${file}`);
      }
    }
  }
  
  console.log(`Updated ${updatedCount} files`);
  
  // Ensure log directory exists
  const logDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(fixLog, null, 2));
  console.log(`Log written to ${CONFIG.logFile}`);
}

// Run main function
main(); 