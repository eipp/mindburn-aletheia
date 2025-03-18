import { createLogger, LogContext } from '@mindburn/shared';

// Create logger instance using the shared implementation
const log = createLogger({
  serviceName: 'worker-interface',
  enableFileLogging: process.env.NODE_ENV === 'production'
});

// Re-export LogContext type for consumers
export type { LogContext };

// Export for backward compatibility
export default log; 