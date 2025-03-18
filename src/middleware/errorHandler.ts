import { ErrorResponse } from '../types';

export class TaskManagementError extends Error {
  constructor(
    public errorCode: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TaskManagementError';
  }
}

export const errorCodes = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  WORKER_NOT_FOUND: 'WORKER_NOT_FOUND',
  INVALID_TASK_STATUS: 'INVALID_TASK_STATUS',
  INVALID_WORKER_STATUS: 'INVALID_WORKER_STATUS',
  NO_QUALIFIED_WORKERS: 'NO_QUALIFIED_WORKERS',
  TASK_ALREADY_ASSIGNED: 'TASK_ALREADY_ASSIGNED',
  WORKER_OVERLOADED: 'WORKER_OVERLOADED',
  INVALID_RESULT: 'INVALID_RESULT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUEUE_ERROR: 'QUEUE_ERROR',
  NOTIFICATION_ERROR: 'NOTIFICATION_ERROR'
} as const;

export function errorHandler<T>(handler: (...args: any[]) => Promise<T>) {
  return async (...args: any[]): Promise<T> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('Error in Lambda handler:', error);

      if (error instanceof TaskManagementError) {
        const errorResponse: ErrorResponse = {
          errorCode: error.errorCode,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        };
        throw new Error(JSON.stringify(errorResponse));
      }

      // Handle AWS SDK errors
      if (error.code) {
        const errorResponse: ErrorResponse = {
          errorCode: `AWS_${error.code}`,
          message: error.message,
          details: {
            requestId: error.requestId,
            statusCode: error.statusCode
          },
          timestamp: new Date().toISOString()
        };
        throw new Error(JSON.stringify(errorResponse));
      }

      // Generic error
      const errorResponse: ErrorResponse = {
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      };
      throw new Error(JSON.stringify(errorResponse));
    }
  };
}

export function validateTask(task: any): void {
  if (!task) {
    throw new TaskManagementError(
      errorCodes.TASK_NOT_FOUND,
      'Task not found'
    );
  }

  if (!task.status) {
    throw new TaskManagementError(
      errorCodes.INVALID_TASK_STATUS,
      'Invalid task status'
    );
  }
}

export function validateWorker(worker: any): void {
  if (!worker) {
    throw new TaskManagementError(
      errorCodes.WORKER_NOT_FOUND,
      'Worker not found'
    );
  }

  if (!worker.status) {
    throw new TaskManagementError(
      errorCodes.INVALID_WORKER_STATUS,
      'Invalid worker status'
    );
  }

  if (worker.currentLoad >= worker.maxLoad) {
    throw new TaskManagementError(
      errorCodes.WORKER_OVERLOADED,
      'Worker has reached maximum task load'
    );
  }
}

export function validateResult(result: any): void {
  if (!result || !result.taskId || !result.workerId) {
    throw new TaskManagementError(
      errorCodes.INVALID_RESULT,
      'Invalid verification result'
    );
  }
} 