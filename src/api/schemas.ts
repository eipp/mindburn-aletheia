import * as Joi from 'joi';

export const submissionSchema = Joi.object({
  taskId: Joi.string().required(),
  workerId: Joi.string().required(),
  taskType: Joi.string().required(),
  content: Joi.object().required(),
  result: Joi.any().required(),
  confidence: Joi.number().min(0).max(1).required(),
  processingTime: Joi.number().positive().required(),
  timestamp: Joi.date().iso().required(),
  ipAddress: Joi.string().ip().required(),
  deviceFingerprint: Joi.object({
    userAgent: Joi.string().required(),
    screenResolution: Joi.string(),
    colorDepth: Joi.number(),
    timezone: Joi.string(),
    language: Joi.string(),
    platform: Joi.string(),
    plugins: Joi.array().items(Joi.string()),
    canvas: Joi.string(),
    webgl: Joi.string(),
    fonts: Joi.array().items(Joi.string()),
    audio: Joi.string(),
  }).required(),
  metadata: Joi.object().default({}),
});

export const webhookSchema = Joi.object({
  type: Joi.string().valid('fraud_alert', 'quality_update', 'system_alert').required(),
  timestamp: Joi.date().iso().required(),
  data: Joi.object({
    workerId: Joi.string().when('type', {
      is: 'fraud_alert',
      then: Joi.required(),
    }),
    taskId: Joi.string().when('type', {
      is: 'quality_update',
      then: Joi.required(),
    }),
    alertLevel: Joi.string().valid('low', 'medium', 'high', 'critical'),
    message: Joi.string().required(),
    details: Joi.object().required(),
  }).required(),
});

export const metricsQuerySchema = Joi.object({
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  granularity: Joi.string().valid('minute', 'hour', 'day').default('hour'),
});
