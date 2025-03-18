7. Data Models and Schema
7.1 Task Data Model
typescriptCopy// Task table schema
interface TaskSchema {
  // Primary key: taskId
  // GSI1: developerId-createdAt
  // GSI2: status-createdAt
  
  taskId: string;  // UUID
  developerId: string;
  contentType: string;
  contentLocation: string;  // S3 URI
  contentHash: string;      // SHA-256 hash
  verificationRequirements: {
    type: string;
    customInstructions?: string;
    urgency: string;
    minVerifierLevel?: number;
    requiredVerifications: number;
  };
  status: "pending" | "in_progress" | "completed" | "failed";
  assignedVerifiers: string[];
  verificationProgress: number;  // 0.0 to 1.0
  consolidatedResult?: {
    status: string;
    confidence: number;
    explanations: string[];
    methodology: string;
  };
  callbackUrl?: string;
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
  completedAt?: string;  // ISO datetime
  failureReason?: string;
  estimatedCompletionTime: string;  // ISO datetime
  ttl?: number;  // Time-to-live for automatic deletion (Unix timestamp)
}
7.2 Worker Data Model
typescriptCopy// Worker table schema
interface WorkerSchema {
  // Primary key: workerId
  // GSI1: telegramId
  // GSI2: skill-level
  
  workerId: string;  // UUID
  telegramId: string;
  displayName: string;
  level: number;  // Overall expertise level (1-5)
  skills: {
    [skillName: string]: number;  // Skill levels (1-5)
  };
  languageCodes: string[];
  availability: {
    status: "active" | "inactive" | "busy";
    schedule?: [{
      dayOfWeek: number;  // 0-6, Sunday is 0
      startHour: number;  // 0-23
      endHour: number;    // 0-23
    }]
  };
  statistics: {
    tasksCompleted: number;
    accuracyRate: number;
    averageResponseTime: number;
    taskBreakdown: {
      [taskType: string]: number;
    }
  };
  taskHistory: {
    taskType: string;
    accuracyScore: number;
  }[];
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
  lastActiveAt: string;  // ISO datetime
  walletAddress?: string;
  fraudScore?: number;  // 0.0 to 1.0
  reputationScore?: number;  // 0.0 to 1.0
}
7.3 Verification Data Model
typescriptCopy// Verification table schema
interface VerificationSchema {
  // Primary key: verificationId
  // GSI1: taskId
  // GSI2: workerId-submittedAt
  
  verificationId: string;  // UUID
  taskId: string;
  workerId: string;
  responses: {
    [fieldId: string]: string | string[] | boolean;
  };
  confidence?: number;  // 0.0 to 1.0
  timeSpent: number;    // In seconds
  qualityScore?: number;  // 0.0 to 1.0
  fraudScore?: number;    // 0.0 to 1.0
  submittedAt: string;    // ISO datetime
  status: "pending_review" | "approved" | "rejected";
  reviewedAt?: string;     // ISO datetime
  reviewerId?: string;     // If manually reviewed
  reviewNotes?: string;
  metadata: {
    ipAddress?: string;
    deviceInfo?: string;
    locationInfo?: object;
  };
  ttl?: number;  // Time-to-live for automatic deletion (Unix timestamp)
}
7.4 Payment Data Model
typescriptCopy// Payment table schema
interface PaymentSchema {
  // Primary key: paymentId
  // GSI1: workerId-createdAt
  // GSI2: status-createdAt
  // GSI3: batchId
  
  paymentId: string;  // UUID
  workerId: string;
  taskId?: string;    // For task rewards
  withdrawalId?: string;  // For withdrawals
  type: "task_reward" | "bonus" | "withdrawal";
  originalAmount: number;
  adjustedAmount: number;
  status: "pending" | "processing" | "completed" | "failed";
  processingStrategy: "immediate" | "batched";
  batchId?: string;
  transactionHash?: string;
  destinationAddress?: string;  // For withdrawals
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
  completedAt?: string;  // ISO datetime
  failureReason?: string;
  ttl?: number;  // Time-to-live for automatic deletion (Unix timestamp)
}
7.5 Developer Data Model
typescriptCopy// Developer table schema
interface DeveloperSchema {
  // Primary key: developerId
  // GSI1: email
  
  developerId: string;  // UUID
  email: string;
  passwordHash: string;
  salt: string;
  companyName: string;
  firstName: string;
  lastName: string;
  apiKeys: [{
    apiKeyId: string;
    apiKeyHash: string;
    createdAt: string;
    expiresAt?: string;
    lastUsed?: string;
    status: "active" | "revoked";
  }];
  billingInfo: {
    billingAddress?: object;
    paymentMethodId?: string;
    planId?: string;
    planStartDate?: string;
    planEndDate?: string;
  };
  settings: {
    defaultCallbackUrl?: string;
    webhookUrl?: string;
    defaultVerificationRequirements?: object;
  };
  usageStats: {
    taskCount: number;
    successfulVerifications: number;
    totalSpend: number;
  };
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
  lastLoginAt: string;  // ISO datetime
  status: "active" | "suspended" | "deleted";
}