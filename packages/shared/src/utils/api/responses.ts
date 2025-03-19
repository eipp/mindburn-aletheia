/**
 * API response utilities for standardized Lambda function responses
 */

/**
 * Response headers with CORS support
 */
export const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

/**
 * Successfully responds to an API Gateway request
 * 
 * @param body The response body
 * @param statusCode The HTTP status code
 * @returns A formatted API Gateway response
 */
export function success(body: any, statusCode = 200) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body),
  };
}

/**
 * Responds with an error to an API Gateway request
 * 
 * @param message The error message
 * @param statusCode The HTTP status code
 * @returns A formatted API Gateway response
 */
export function error(message: string, statusCode = 500) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Creates a validation error response
 * 
 * @param errors Validation error details
 * @returns A formatted API Gateway response
 */
export function validationError(errors: Record<string, string[]>) {
  return error('Validation failed', 400);
}

/**
 * Creates a not found error response
 * 
 * @param message Custom not found message
 * @returns A formatted API Gateway response
 */
export function notFound(message = 'Resource not found') {
  return error(message, 404);
}

/**
 * Creates an unauthorized error response
 * 
 * @param message Custom unauthorized message
 * @returns A formatted API Gateway response
 */
export function unauthorized(message = 'Unauthorized') {
  return error(message, 401);
}

/**
 * Creates a forbidden error response
 * 
 * @param message Custom forbidden message
 * @returns A formatted API Gateway response
 */
export function forbidden(message = 'Forbidden') {
  return error(message, 403);
}

/**
 * Creates a no content success response
 * 
 * @returns A formatted API Gateway response
 */
export function noContent() {
  return {
    statusCode: 204,
    headers: defaultHeaders,
    body: '',
  };
} 