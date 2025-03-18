import { z } from 'zod';

// Common Types
export const ErrorResponse = z.object({
  code: z.number(),
  message: z.string(),
  details: z.any().optional(),
});

// Authentication API Types
export const RegisterRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

export const RegisterResponse = z.object({
  developerId: z.string(),
  email: z.string().email(),
  apiKey: z.string(),
  createdAt: z.string(),
});

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const LoginResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
  developerId: z.string(),
});

export const ApiKeyResponse = z.object({
  apiKey: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});

export const ApiKeyListResponse = z.object({
  apiKeys: z.array(
    z.object({
      apiKeyId: z.string(),
      lastUsed: z.string().nullable(),
      createdAt: z.string(),
      expiresAt: z.string().nullable(),
      status: z.enum(['active', 'revoked']),
    })
  ),
});

// Verification Task API Types
export const TaskRequest = z.object({
  contentType: z.enum(['text', 'image', 'audio', 'video', 'document']),
  content: z.union([
    z.string(),
    z.object({
      url: z.string().url(),
      hash: z.string(),
    }),
  ]),
  verificationRequirements: z.object({
    type: z.enum(['content_moderation', 'fact_check', 'toxicity', 'sentiment', 'custom']),
    customInstructions: z.string().optional(),
    urgency: z.enum(['standard', 'high', 'critical']),
    minVerifierLevel: z.number().min(1).max(5).optional(),
    requiredVerifications: z.number().min(1),
  }),
  callbackUrl: z.string().url().optional(),
});

export const TaskResponse = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  estimatedCompletionTime: z.string(),
  createdAt: z.string(),
});

export const TaskResultResponse = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  estimatedCompletionTime: z.string().optional(),
  results: z
    .object({
      status: z.string(),
      confidence: z.number(),
      explanations: z.array(z.string()),
      verificationCount: z.number(),
      verifierLevels: z.array(z.number()),
      completedAt: z.string(),
    })
    .optional(),
});

// Webhook API Types
export const WebhookRequest = z.object({
  url: z.string().url(),
  events: z.array(z.enum(['task.created', 'task.in_progress', 'task.completed', 'task.failed'])),
  secret: z.string(),
  description: z.string().optional(),
});

export const WebhookResponse = z.object({
  webhookId: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  createdAt: z.string(),
  status: z.literal('active'),
});

// Analytics API Types
export const AnalyticsTaskRequest = z.object({
  startDate: z.string(),
  endDate: z.string(),
  interval: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
});

export const AnalyticsResultRequest = z.object({
  startDate: z.string(),
  endDate: z.string(),
  taskType: z.string().optional(),
});

export const AnalyticsBillingRequest = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

// Export type definitions
export type RegisterRequestType = z.infer<typeof RegisterRequest>;
export type RegisterResponseType = z.infer<typeof RegisterResponse>;
export type LoginRequestType = z.infer<typeof LoginRequest>;
export type LoginResponseType = z.infer<typeof LoginResponse>;
export type TaskRequestType = z.infer<typeof TaskRequest>;
export type TaskResponseType = z.infer<typeof TaskResponse>;
export type WebhookRequestType = z.infer<typeof WebhookRequest>;
export type WebhookResponseType = z.infer<typeof WebhookResponse>;
