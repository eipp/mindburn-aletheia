import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createLogger } from '@mindburn/shared';
import { ApiError } from '../errors/ApiError';

const logger = createLogger('ErrorHandler');

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Error occurred', {
    error,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    params: req.params,
    headers: {
      ...req.headers,
      authorization: undefined, // Don't log auth headers
    },
  });

  // Handle validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      errors: error.errors,
    });
  }

  // Handle known API errors
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      status: 'error',
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  // Handle JWT authentication errors
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing authentication token',
    });
  }

  // Handle rate limit errors
  if (error.name === 'RateLimitExceeded') {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    });
  }

  // Handle database connection errors
  if (error.name === 'MongoError' || error.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Database service unavailable',
    });
  }

  // Handle AWS service errors
  if (error.name === 'AWS.DynamoDB.Error') {
    return res.status(503).json({
      status: 'error',
      code: 'AWS_SERVICE_ERROR',
      message: 'AWS service unavailable',
    });
  }

  // Handle blockchain service errors
  if (error.name === 'TonServiceError') {
    return res.status(503).json({
      status: 'error',
      code: 'BLOCKCHAIN_SERVICE_ERROR',
      message: 'Blockchain service unavailable',
    });
  }

  // Handle unknown errors
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
