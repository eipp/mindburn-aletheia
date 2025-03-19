import { z } from 'zod';

// Base event schema with common fields
const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  correlationId: z.string().uuid(),
  source: z.string(),
  version: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Task Events
export const TaskCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('task.created'),
  data: z.object({
    taskId: z.string().uuid(),
    developerId: z.string(),
    taskType: z.string(),
    priority: z.number(),
    requirements: z.record(z.string(), z.unknown()),
  }),
});

export const TaskAssignedEventSchema = BaseEventSchema.extend({
  type: z.literal('task.assigned'),
  data: z.object({
    taskId: z.string().uuid(),
    workerId: z.string(),
    assignedAt: z.string().datetime(),
    deadline: z.string().datetime(),
  }),
});

export const VerificationSubmittedEventSchema = BaseEventSchema.extend({
  type: z.literal('verification.submitted'),
  data: z.object({
    taskId: z.string().uuid(),
    workerId: z.string(),
    result: z.object({
      verdict: z.enum(['approved', 'rejected']),
      confidence: z.number(),
      evidence: z.array(z.unknown()),
    }),
    submittedAt: z.string().datetime(),
  }),
});

export const PaymentProcessedEventSchema = BaseEventSchema.extend({
  type: z.literal('payment.processed'),
  data: z.object({
    taskId: z.string().uuid(),
    workerId: z.string(),
    amount: z.number(),
    currency: z.literal('TON'),
    transactionHash: z.string(),
    status: z.enum(['completed', 'failed']),
  }),
});

export const UserRegisteredEventSchema = BaseEventSchema.extend({
  type: z.literal('user.registered'),
  data: z.object({
    userId: z.string().uuid(),
    userType: z.enum(['developer', 'worker']),
    telegramId: z.string(),
    walletAddress: z.string().optional(),
    registeredAt: z.string().datetime(),
  }),
});

// Type exports
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type TaskCreatedEvent = z.infer<typeof TaskCreatedEventSchema>;
export type TaskAssignedEvent = z.infer<typeof TaskAssignedEventSchema>;
export type VerificationSubmittedEvent = z.infer<typeof VerificationSubmittedEventSchema>;
export type PaymentProcessedEvent = z.infer<typeof PaymentProcessedEventSchema>;
export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;

// Event type union
export type AletheiaEvent =
  | TaskCreatedEvent
  | TaskAssignedEvent
  | VerificationSubmittedEvent
  | PaymentProcessedEvent
  | UserRegisteredEvent;
