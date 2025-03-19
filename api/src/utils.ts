/**
 * Utility functions for the API
 * @deprecated Import from @mindburn/shared/src/utils/api/responses and @mindburn/shared/src/utils/logging instead
 */

// Export shared utilities
export { 
  success, 
  error, 
  validationError, 
  notFound, 
  unauthorized, 
  forbidden 
} from '@mindburn/shared/src/utils/api/responses';

// Import the logger
import { createLogger } from '@mindburn/shared/src/utils/logging/logger';

const logger = createLogger({ service: 'api' });

/**
 * Simple logger
 * @deprecated Use @mindburn/shared/src/utils/logging/logger instead
 */
export function log(level: string, message: string, meta?: any) {
  if (level === 'error') {
    logger.error(message, meta);
  } else if (level === 'warn') {
    logger.warn(message, meta);
  } else if (level === 'debug') {
    logger.debug(message, meta);
  } else {
    logger.info(message, meta);
  }
} 