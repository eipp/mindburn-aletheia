import { createLogger } from '@mindburn/shared/src/utils/logging/logger';
import { initializeRequestValidation } from './applyValidation';

const logger = createLogger({ service: 'APIMiddleware' });

/**
 * Initialize all API middleware
 * This function is called during application startup to set up 
 * middleware components like request validation
 */
export async function initializeMiddleware(): Promise<void> {
  try {
    logger.info('Initializing API middleware');
    
    // Initialize request validation
    await initializeRequestValidation();
    
    logger.info('API middleware initialization complete');
  } catch (error) {
    logger.error('Failed to initialize API middleware', { error });
    throw error; // Re-throw to allow graceful handling by caller
  }
}

// Auto-initialize middleware when this module is loaded in production
// In local development/test, this should be called explicitly
if (process.env.NODE_ENV === 'production') {
  initializeMiddleware().catch(error => {
    logger.error('Unhandled middleware initialization error', { error });
    // Don't crash the process, but log the error
    // Any endpoints without validation will still work
  });
} 