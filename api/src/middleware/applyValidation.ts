import fs from 'fs';
import path from 'path';
import { createLogger } from '@mindburn/shared/src/utils/logging/logger';
import { z } from 'zod';
import { validateRequest } from './validateRequest';

const logger = createLogger({ service: 'ValidationApplier' });

/**
 * Apply Zod validation to all handlers in a directory
 * This is a utility function used during initialization to register validation schemas
 * with all API endpoints.
 * 
 * @param baseDir The directory containing handler files
 * @param schemaDir The directory containing validation schemas
 */
export async function applyValidationToHandlers(
  baseDir: string,
  schemaDir: string
): Promise<void> {
  logger.info('Starting validation application to API handlers', { baseDir, schemaDir });
  
  // Load all schema files
  const schemas = loadSchemas(schemaDir);
  
  // Find all handler files
  const handlerFiles = findHandlerFiles(baseDir);
  
  let appliedCount = 0;
  
  // Apply schemas to handlers
  for (const handlerFile of handlerFiles) {
    const relativePath = path.relative(baseDir, handlerFile);
    const handlerName = path.basename(handlerFile, path.extname(handlerFile));
    
    // Look for a matching schema
    const schema = schemas[handlerName];
    if (!schema) {
      logger.warn(`No schema found for handler: ${handlerName}`, { file: relativePath });
      continue;
    }
    
    // Validate schema
    if (!isValidSchema(schema)) {
      logger.warn(`Invalid schema for handler: ${handlerName}`, { file: relativePath });
      continue;
    }
    
    // Apply validation to handler
    try {
      const handlerModule = require(handlerFile);
      
      if (typeof handlerModule.handler !== 'function') {
        logger.warn(`No handler function found in ${handlerName}`, { file: relativePath });
        continue;
      }
      
      // Apply validation middleware
      const originalHandler = handlerModule.handler;
      handlerModule.handler = validateRequest(schema, originalHandler);
      
      logger.info(`Applied validation to handler: ${handlerName}`, { file: relativePath });
      appliedCount++;
    } catch (error) {
      logger.error(`Error applying validation to ${handlerName}`, { error, file: relativePath });
    }
  }
  
  logger.info(`Completed validation application`, { total: handlerFiles.length, applied: appliedCount });
}

/**
 * Load all schema files from a directory
 */
function loadSchemas(schemaDir: string): Record<string, z.ZodSchema> {
  const schemas: Record<string, z.ZodSchema> = {};
  
  if (!fs.existsSync(schemaDir)) {
    logger.warn(`Schema directory does not exist: ${schemaDir}`);
    return schemas;
  }
  
  const schemaFiles = fs.readdirSync(schemaDir)
    .filter(file => file.endsWith('.schema.ts') || file.endsWith('.schema.js'));
  
  for (const file of schemaFiles) {
    try {
      const filePath = path.join(schemaDir, file);
      const schema = require(filePath).default;
      
      if (!isValidSchema(schema)) {
        logger.warn(`Invalid schema in ${file}`);
        continue;
      }
      
      const handlerName = file.replace(/\.schema\.(ts|js)$/, '');
      schemas[handlerName] = schema;
      
      logger.debug(`Loaded schema for ${handlerName}`);
    } catch (error) {
      logger.error(`Error loading schema file: ${file}`, { error });
    }
  }
  
  logger.info(`Loaded ${Object.keys(schemas).length} schemas`);
  return schemas;
}

/**
 * Find all handler files in a directory
 */
function findHandlerFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    logger.warn(`Handler directory does not exist: ${dir}`);
    return files;
  }
  
  function scan(directory: string) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          scan(fullPath);
        }
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.includes('.schema.')
      ) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  logger.info(`Found ${files.length} handler files`);
  return files;
}

/**
 * Check if a value is a valid Zod schema
 */
function isValidSchema(schema: any): schema is z.ZodSchema {
  return schema && typeof schema.parse === 'function' && typeof schema.safeParse === 'function';
}

/**
 * Initialize validation for all API endpoints
 */
export async function initializeRequestValidation(): Promise<void> {
  const apiRoot = path.resolve(__dirname, '..');
  const handlerDirs = [
    path.join(apiRoot, 'developer', 'handlers'),
    path.join(apiRoot, 'task', 'handlers'),
    path.join(apiRoot, 'worker', 'handlers'),
  ];
  
  const schemaDir = path.join(apiRoot, 'schemas');
  
  // Apply validation to each handler directory
  for (const dir of handlerDirs) {
    await applyValidationToHandlers(dir, schemaDir);
  }
  
  logger.info('Request validation initialized for all API endpoints');
} 