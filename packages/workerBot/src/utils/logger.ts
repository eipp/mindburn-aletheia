import logger, { LogLevel } from '@mindburn/shared/src/utils/logging/logger';

// Re-export the shared logger with worker-bot specific configuration
export default logger.create({
  service: 'worker-bot',
  level: LogLevel.INFO,
});

// Export the LogLevel enum for convenience
export { LogLevel };

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'combined.log',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
}

logger.info = (message: string, meta?: any) => logger.info(message, meta);
logger.error = (message: string, error?: any) => logger.error(message, { error });
logger.warn = (message: string, meta?: any) => logger.warn(message, meta);
logger.debug = (message: string, meta?: any) => logger.debug(message, meta);

// Specific logging functions for different components
logger.bot = {
  command: (command: string, userId: string, meta?: any) =>
    logger.info(`Bot command: ${command}`, { userId, command, ...meta }),
  error: (error: any, userId: string, context?: any) =>
    logger.error('Bot error', { userId, error, context }),
  message: (type: string, userId: string, meta?: any) =>
    logger.debug(`Bot message: ${type}`, { userId, type, ...meta }),
};

logger.task = {
  start: (taskId: string, userId: string) => logger.info('Task started', { taskId, userId }),
  complete: (taskId: string, userId: string, success: boolean) =>
    logger.info('Task completed', { taskId, userId, success }),
  error: (taskId: string, userId: string, error: any) =>
    logger.error('Task error', { taskId, userId, error }),
};

logger.wallet = {
  transaction: (type: string, userId: string, amount: number, meta?: any) =>
    logger.info('Wallet transaction', { type, userId, amount, ...meta }),
  error: (operation: string, userId: string, error: any) =>
    logger.error('Wallet error', { operation, userId, error }),
};
