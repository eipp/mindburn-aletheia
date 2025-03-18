import logger, { LogLevel } from '@mindburn/shared/src/utils/logging/logger';

// Re-export the shared logger with worker-webapp specific configuration
export default logger.create({
  service: 'worker-webapp',
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  console: true,
  file: process.env.NODE_ENV === 'production'
});

// Export the LogLevel enum for convenience
export { LogLevel }; 