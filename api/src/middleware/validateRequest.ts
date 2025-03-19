import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { createLogger } from '@mindburn/shared/src/utils/logging/logger';
import { error } from '@mindburn/shared/src/utils/api/responses';

const logger = createLogger({ service: 'RequestValidator' });

// Handler function type with validation
export type ValidatedAPIHandler<T> = (
  event: APIGatewayProxyEvent, 
  validatedData: T
) => Promise<APIGatewayProxyResult>;

/**
 * Creates a middleware that validates request data against a Zod schema
 * @param schema Zod schema to validate request against
 * @param handler Handler function to execute if validation passes
 * @param options Validation options
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  handler: ValidatedAPIHandler<T>,
  options: {
    source?: 'body' | 'queryStringParameters' | 'pathParameters' | 'all';
    stripUnknown?: boolean;
  } = { source: 'body', stripUnknown: true }
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      let dataToValidate: any;

      // Get data from specified source
      switch (options.source) {
        case 'body':
          dataToValidate = event.body ? JSON.parse(event.body) : {};
          break;
        case 'queryStringParameters':
          dataToValidate = event.queryStringParameters || {};
          break;
        case 'pathParameters':
          dataToValidate = event.pathParameters || {};
          break;
        case 'all':
          dataToValidate = {
            body: event.body ? JSON.parse(event.body) : {},
            query: event.queryStringParameters || {},
            path: event.pathParameters || {},
            headers: event.headers || {}
          };
          break;
        default:
          dataToValidate = event.body ? JSON.parse(event.body) : {};
      }

      // Validate data against schema
      const validationResult = schema.safeParse(dataToValidate);

      if (!validationResult.success) {
        const validationErrors = validationResult.error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }));

        logger.warn('Request validation failed', { 
          errors: validationErrors,
          path: event.path,
          method: event.httpMethod
        });

        return error('Validation failed: ' + validationErrors.map(e => `${e.path} - ${e.message}`).join(', '), 400);
      }

      // Call handler with validated data
      return await handler(event, validationResult.data);
    } catch (err: any) {
      logger.error('Validation middleware error', { 
        error: err.message, 
        stack: err.stack,
        path: event.path,
        method: event.httpMethod
      });
      
      if (err.message.includes('JSON')) {
        return error('Invalid JSON in request body', 400);
      }
      
      return error('Internal server error during request validation', 500);
    }
  };
}

/**
 * Creates a partial schema validator that doesn't require all fields
 * @param schema Zod schema to make partial
 */
export function createPartialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Creates a validation schema for pagination parameters
 */
export const paginationSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  nextToken: z.string().optional()
});

/**
 * Creates a validation schema for common query parameters
 */
export const commonQuerySchema = z.object({
  ...paginationSchema.shape,
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
}); 