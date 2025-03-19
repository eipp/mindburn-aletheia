import { APIGatewayProxyHandler } from 'aws-lambda';
import { success, error } from '@mindburn/shared/src/utils/api/responses';
import { createLogger } from '@mindburn/shared/src/utils/logging/logger';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validateRequest';

const logger = createLogger({ service: 'DemoHandler' });

// Define validation schema for the demo endpoint
const demoSchema = z.object({
  data: z.string().min(1, "Data must not be empty"),
  options: z.object({
    processType: z.enum(['standard', 'premium', 'express']).optional(),
    priority: z.number().int().min(1).max(10).optional()
  }).optional(),
  metadata: z.record(z.string()).optional()
});

// Define the type from the schema for better type safety
type DemoRequest = z.infer<typeof demoSchema>;

// Raw handler implementation
const handleDemoRequest = async (event: any, validatedData: DemoRequest) => {
  try {
    logger.info('Processing demo request', { data: validatedData });
    
    return success({
      message: 'Demo response',
      processedData: {
        originalData: validatedData.data,
        uppercase: validatedData.data.toUpperCase(),
        length: validatedData.data.length
      },
      options: validatedData.options,
      metadata: validatedData.metadata,
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod,
      queryParams: event.queryStringParameters
    });
  } catch (err: any) {
    logger.error('Demo handler error', { error: err.message, stack: err.stack });
    return error(err.message);
  }
};

// Wrap the handler with validation middleware
export const handler: APIGatewayProxyHandler = validateRequest(demoSchema, handleDemoRequest); 