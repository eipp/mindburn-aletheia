/**
 * Core functionality for Mindburn Aletheia
 *
 * This package contains core functionality shared across the application.
 */

// Export core functionality here
export const VERSION = '0.1.0';

/**
 * Simple health check function
 */
export function healthCheck() {
  return {
    status: 'healthy',
    version: VERSION,
    timestamp: new Date().toISOString(),
  };
}
