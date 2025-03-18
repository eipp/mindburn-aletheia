#!/usr/bin/env node

/**
 * Configuration Consolidation Script
 * 
 * This script identifies and consolidates configuration code into the shared package.
 * It looks for duplicated config patterns and moves them to packages/shared/src/config.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  logFile: 'config-consolidation-log.json',
  sourcePatterns: [
    '**/src/**/config*.ts',
    '**/src/config/*.ts',
    '**/src/utils/env*.ts',
    '**/src/utils/environment*.ts'
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
  targetDir: 'packages/shared/src/config'
};

// Regular expressions for finding configuration patterns
const CONFIG_PATTERNS = [
  // Match common environment variable transformer functions
  /export\s+(const|function)\s+(\w+)(Environment|Config|EnvTransformer|ConfigTransformer|EnvLoader).*?\{[\s\S]+?\}/g,
  
  // Match configuration interfaces
  /export\s+(interface|type)\s+(\w+)(Config|Configuration|Env|Environment|Options).*?\{[\s\S]+?\}/g,
  
  // Match configuration constants
  /export\s+const\s+(\w+)_*(?:CONFIG|ENVIRONMENT|ENV)\s*=\s*[{[]/,
  
  // Match environment validation schemas
  /export\s+const\s+(\w+)Schema\s*=\s*z\.object\(\{[\s\S]+?\}\)/g
];

// Log for recording changes
const migrationLog = {
  timestamp: new Date().toISOString(),
  identifiedFiles: [],
  extractedConfigs: [],
  movedFiles: [],
  errors: []
};

/**
 * Main function
 */
async function main() {
  console.log(`Configuration consolidation script - ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  
  // Ensure target directory exists
  if (!fs.existsSync(CONFIG.targetDir) && !CONFIG.dryRun) {
    fs.mkdirSync(CONFIG.targetDir, { recursive: true });
    console.log(`Created target directory: ${CONFIG.targetDir}`);
  }
  
  // Find all potential configuration files
  let sourceFiles = [];
  for (const pattern of CONFIG.sourcePatterns) {
    const files = glob.sync(pattern, { 
      ignore: CONFIG.excludeDirs.map(dir => `${dir}/**`)
    });
    sourceFiles = [...sourceFiles, ...files];
  }
  
  // Skip files from the shared package
  sourceFiles = sourceFiles.filter(file => !file.startsWith('packages/shared/'));
  
  console.log(`Found ${sourceFiles.length} potential configuration files to analyze`);
  
  // Process each file
  for (const sourceFile of sourceFiles) {
    try {
      // Read file content
      const content = fs.readFileSync(sourceFile, 'utf8');
      
      // Check if this is likely a configuration file
      let isConfigFile = false;
      let extractedConfigs = [];
      
      for (const pattern of CONFIG_PATTERNS) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          isConfigFile = true;
          extractedConfigs.push({
            name: match[2] ? match[2] + (match[3] || '') : match[1],
            code: match[0]
          });
        }
      }
      
      if (isConfigFile) {
        migrationLog.identifiedFiles.push(sourceFile);
        migrationLog.extractedConfigs = [
          ...migrationLog.extractedConfigs,
          ...extractedConfigs.map(c => ({ 
            file: sourceFile, 
            name: c.name 
          }))
        ];
        
        if (CONFIG.verbose) {
          console.log(`Identified configuration file: ${sourceFile}`);
          console.log(`Found configs: ${extractedConfigs.map(c => c.name).join(', ')}`);
        }
        
        // Create a new file in the target directory
        const fileName = path.basename(sourceFile);
        const packageName = sourceFile.split('/')[1]; // e.g., 'worker-bot'
        const targetFileName = `${packageName}-${fileName}`;
        const targetFile = path.join(CONFIG.targetDir, targetFileName);
        
        // Generate the new file content
        const imports = [
          '/**',
          ` * Consolidated configuration from ${sourceFile}`,
          ' */',
          '',
          "import { z } from 'zod';", // Common validation library import
          ''
        ].join('\n');
        
        const configCode = extractedConfigs.map(c => c.code).join('\n\n');
        const newContent = imports + configCode;
        
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
  
  console.log(`Identified ${migrationLog.identifiedFiles.length} configuration files`);
  console.log(`Extracted ${migrationLog.extractedConfigs.length} configurations`);
  console.log(`Created ${migrationLog.movedFiles.length} consolidated files in the shared package`);
  
  // Create factory function for loading configuration
  if (!CONFIG.dryRun) {
    const factoryContent = [
      '/**',
      ' * Configuration factory functions',
      ' */',
      '',
      "import { z } from 'zod';",
      '',
      '/**',
      ' * Creates an environment transformer that loads and validates environment variables',
      ' * @param schema The Zod schema to validate against',
      ' * @returns A function that transforms and validates environment variables',
      ' */',
      'export function createEnvironmentTransformer<T>(schema: z.ZodSchema<T>) {',
      '  return (env: Record<string, string | undefined>): T => {',
      '    const result = schema.safeParse(env);',
      '    ',
      '    if (!result.success) {',
      '      const formatted = result.error.format();',
      '      const message = `Environment validation failed: ${JSON.stringify(formatted, null, 2)}`;',
      '      throw new Error(message);',
      '    }',
      '    ',
      '    return result.data;',
      '  };',
      '}',
      '',
      '/**',
      ' * Creates a config validator that checks for required environment variables',
      ' * @param options Options specifying required and optional variables',
      ' * @returns An object with the validated environment variables',
      ' */',
      'export function createConfigValidator(options: { required: string[], optional?: string[] }) {',
      '  const { required, optional = [] } = options;',
      '  ',
      '  const schema: Record<string, z.ZodTypeAny> = {};',
      '  ',
      '  for (const key of required) {',
      '    schema[key] = z.string().min(1, `${key} is required`);',
      '  }',
      '  ',
      '  for (const key of optional) {',
      '    schema[key] = z.string().optional();',
      '  }',
      '  ',
      '  return createEnvironmentTransformer(z.object(schema));',
      '}',
      ''
    ].join('\n');
    
    fs.writeFileSync(path.join(CONFIG.targetDir, 'configFactory.ts'), factoryContent, 'utf8');
    console.log('Created configuration factory file');
  }
  
  // Create an index file
  if (migrationLog.movedFiles.length > 0 && !CONFIG.dryRun) {
    const indexContent = [
      '/**',
      ' * Index file for consolidated configuration',
      ' */',
      '',
      "export * from './configFactory';",
      '',
      ...migrationLog.movedFiles.map(file => {
        const fileName = path.basename(file.to, '.ts');
        return `export * from './${fileName}';`;
      }),
      ''
    ].join('\n');
    
    fs.writeFileSync(path.join(CONFIG.targetDir, 'index.ts'), indexContent, 'utf8');
    console.log('Created index file for consolidated configuration');
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