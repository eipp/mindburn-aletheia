import winston from 'winston';
import { AWSError } from 'aws-sdk';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const getLogLevel = () => {
  const level = process.env.LOG_LEVEL || 'info';
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, level) ? level : 'info';
};

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

const logger = winston.createLogger({
  level: getLogLevel(),
  levels: LOG_LEVELS,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    environment: process.env.STAGE || 'dev',
    service: 'worker-interface',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

export const log = {
  error: (message: string, error?: Error | AWSError, context?: LogContext) => {
    logger.error(message, {
      ...(error && { error: formatError(error) }),
      ...context,
    });
  },

  warn: (message: string, context?: LogContext) => {
    logger.warn(message, context);
  },

  info: (message: string, context?: LogContext) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: LogContext) => {
    logger.debug(message, context);
  },

  startRequest: (context: LogContext) => {
    logger.info('Request started', context);
  },

  endRequest: (context: LogContext) => {
    logger.info('Request completed', context);
  },
};

export default log; 