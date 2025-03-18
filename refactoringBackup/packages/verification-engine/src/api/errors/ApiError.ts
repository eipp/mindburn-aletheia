export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public cause?: Error | unknown,
    public code: string = 'API_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }

    // If cause is an error, preserve its stack
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  // Factory methods for common error types
  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, null, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(message, 401, null, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(message, 403, null, 'FORBIDDEN');
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(message, 404, null, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(message, 409, null, 'CONFLICT', details);
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(message, 429, null, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Internal server error', cause?: Error): ApiError {
    return new ApiError(message, 500, cause, 'INTERNAL_SERVER_ERROR');
  }

  static serviceUnavailable(service: string, cause?: Error): ApiError {
    return new ApiError(
      `${service} service unavailable`,
      503,
      cause,
      'SERVICE_UNAVAILABLE'
    );
  }

  // Convert to a safe response object (no sensitive info)
  toResponse() {
    return {
      status: 'error',
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
} 