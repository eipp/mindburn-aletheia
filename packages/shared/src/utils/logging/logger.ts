import winston from 'winston';
import { AWSError } from 'aws-sdk';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose'
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  console?: boolean;
  file?: boolean;
  filePath?: string;
}

/**
 * Default logger options
 */
const defaultOptions: LoggerOptions = {
  level: LogLevel.INFO,
  service: 'mindburn-aletheia',
  console: true,
  file: false,
  filePath: 'logs/app.log'
};

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

interface LoggerOptions {
  serviceName: string;
  environment?: string;
  enableFileLogging?: boolean;
  logLevel?: string;
  logFilePath?: string;
}

const formatError = (error: Error | AWSError) => {
  const formattedError = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };

  if ('code' in error) {
    return {
      ...formattedError,
      code: error.code,
      statusCode: (error as AWSError).statusCode,
      requestId: (error as AWSError).requestId,
    };
  }

  return formattedError;
};

/**
 * Create a logger instance with the specified options
 */
export function createLogger(options: LoggerOptions = {}): winston.Logger {
  const mergedOptions = { ...defaultOptions, ...options };
  
  const transports: winston.transport[] = [];
  
  // Add console transport if enabled
  if (mergedOptions.console) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      })
    );
  }
  
  // Add file transport if enabled
  if (mergedOptions.file && mergedOptions.filePath) {
    transports.push(
      new winston.transports.File({
        filename: mergedOptions.filePath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    );
  }
  
  return winston.createLogger({
    level: mergedOptions.level,
    defaultMeta: { service: mergedOptions.service },
    transports
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Logger utility for standardized logging across the application
 */
export default {
  /**
   * Create a new logger instance with custom options
   */
  create: (options: LoggerOptions = {}) => createLogger(options),
  
  /**
   * Log an error message
   */
  error: (message: string, meta: Record<string, any> = {}) => {
    logger.error(message, meta);
  },
  
  /**
   * Log a warning message
   */
  warn: (message: string, meta: Record<string, any> = {}) => {
    logger.warn(message, meta);
  },
  
  /**
   * Log an info message
   */
  info: (message: string, meta: Record<string, any> = {}) => {
    logger.info(message, meta);
  },
  
  /**
   * Log a debug message
   */
  debug: (message: string, meta: Record<string, any> = {}) => {
    logger.debug(message, meta);
  },
  
  /**
   * Log a verbose message
   */
  verbose: (message: string, meta: Record<string, any> = {}) => {
    logger.verbose(message, meta);
  },

  startRequest: (context: LogContext) => {
    logger.info('Request started', context);
  },

  endRequest: (context: LogContext) => {
    logger.info('Request completed', context);
  },
  
  // Specialized logging functions
  bot: {
    command: (command: string, userId: string, meta?: any) =>
      logger.info(`Bot command: ${command}`, { userId, command, ...meta }),
    error: (error: any, userId: string, context?: any) =>
      logger.error('Bot error', { userId, error, context }),
    message: (type: string, userId: string, meta?: any) =>
      logger.debug(`Bot message: ${type}`, { userId, type, ...meta })
  },
  
  task: {
    start: (taskId: string, userId: string) =>
      logger.info('Task started', { taskId, userId }),
    complete: (taskId: string, userId: string, success: boolean) =>
      logger.info('Task completed', { taskId, userId, success }),
    error: (taskId: string, userId: string, error: any) =>
      logger.error('Task error', { taskId, userId, error })
  },
  
  wallet: {
    transaction: (type: string, userId: string, amount: number, meta?: any) =>
      logger.info('Wallet transaction', { type, userId, amount, ...meta }),
    error: (operation: string, userId: string, error: any) =>
      logger.error('Wallet error', { operation, userId, error })
  }
};

// Export types for consumers
export type { LogContext }; 