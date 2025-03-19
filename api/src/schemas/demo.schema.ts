import { z } from 'zod';

/**
 * Validation schema for the demo endpoint
 * 
 * This schema defines the expected structure and validation rules for
 * requests to the demo API endpoint.
 */
const demoSchema = z.object({
  data: z.string().min(1, "Data must not be empty").max(1000, "Data cannot exceed 1000 characters"),
  options: z.object({
    processType: z.enum(['standard', 'premium', 'express']).optional(),
    priority: z.number().int().min(1).max(10).optional()
  }).optional(),
  metadata: z.record(z.string()).optional()
});

export default demoSchema; 