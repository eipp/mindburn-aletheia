export enum TaskType {
  CONTENT_MODERATION = 'content_moderation',
  FACT_CHECK = 'fact_check',
  TOXICITY = 'toxicity',
  SENTIMENT = 'sentiment',
  CUSTOM = 'custom',
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PaymentType {
  TASK_REWARD = 'task_reward',
  BONUS = 'bonus',
  WITHDRAWAL = 'withdrawal',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
