1. System Architecture Overview
   The Aletheia platform uses a serverless microservices architecture on AWS with the following core components:

Developer Platform: API Gateway, authentication, and developer dashboard
Task Management System: Task queues, distribution, and workflow orchestration
Worker Interface: Telegram Bot, Mini App, and notification services
Verification Engine: Multi-method verification and result consolidation
Payment System: TON blockchain integration with batched payments

All components communicate via well-defined APIs and use event-driven patterns for scalability and resilience. 2. Developer Platform API Contracts
2.1 Developer API
Authentication API
typescriptCopy// Authentication Endpoints
interface AuthAPI {
// Register a new developer account
POST /auth/register: {
request: {
email: string;
password: string;
companyName: string;
firstName: string;
lastName: string;
},
response: {
developerId: string;
email: string;
apiKey: string; // Initial API key
createdAt: string;
},
errors: {
400: "Invalid request data",
409: "Email already registered"
}
}

// Login to developer account
POST /auth/login: {
request: {
email: string;
password: string;
},
response: {
token: string; // JWT token
expiresAt: string;
developerId: string;
},
errors: {
400: "Invalid credentials",
403: "Account locked"
}
}

// Generate new API key (invalidates previous)
POST /auth/api-keys: {
request: {}, // Authenticated with JWT
response: {
apiKey: string;
createdAt: string;
expiresAt: string | null; // null = no expiration
},
errors: {
401: "Unauthorized"
}
}

// Retrieve API keys
GET /auth/api-keys: {
request: {}, // Authenticated with JWT
response: {
apiKeys: [{
apiKeyId: string;
lastUsed: string | null;
createdAt: string;
expiresAt: string | null;
status: "active" | "revoked";
}]
},
errors: {
401: "Unauthorized"
}
}

// Revoke an API key
DELETE /auth/api-keys/{apiKeyId}: {
request: {}, // Authenticated with JWT
response: {
success: boolean;
revokedAt: string;
},
errors: {
401: "Unauthorized",
404: "API key not found"
}
}
}
Verification Task API
typescriptCopy// Verification Task Endpoints
interface VerificationTaskAPI {
// Submit a new verification task
POST /tasks: {
request: {
contentType: "text" | "image" | "audio" | "video" | "document";
content: string | {
url: string; // S3 pre-signed URL or public URL
hash: string; // SHA-256 hash of content
};
verificationRequirements: {
type: "content_moderation" | "fact_check" | "toxicity" | "sentiment" | "custom";
customInstructions?: string;
urgency: "standard" | "high" | "critical";
minVerifierLevel?: number; // Minimum verifier expertise level (1-5)
requiredVerifications: number; // Number of independent verifications
};
callbackUrl?: string; // Optional webhook URL
},
response: {
taskId: string;
status: "pending";
estimatedCompletionTime: string; // ISO datetime
createdAt: string;
},
errors: {
400: "Invalid request data",
401: "Invalid API key",
402: "Insufficient funds",
413: "Content too large",
415: "Unsupported content type",
429: "Rate limit exceeded"
}
}

// Get task status and results
GET /tasks/{taskId}: {
request: {}, // Authenticated with API key
response: {
taskId: string;
status: "pending" | "in_progress" | "completed" | "failed";
createdAt: string;
updatedAt: string;
estimatedCompletionTime?: string;
results?: {
status: string; // Varies based on verification type
confidence: number; // 0.0 to 1.0
explanations: string[];
verificationCount: number;
verifierLevels: number[]; // Expertise levels of verifiers
completedAt: string;
}
},
errors: {
401: "Unauthorized",
404: "Task not found"
}
}

// List verification tasks
GET /tasks: {
request: {
status?: "pending" | "in_progress" | "completed" | "failed";
startDate?: string; // ISO date
endDate?: string; // ISO date
limit?: number; // Default 50, max 100
offset?: number; // For pagination
},
response: {
tasks: [{
taskId: string;
status: "pending" | "in_progress" | "completed" | "failed";
contentType: string;
createdAt: string;
updatedAt: string;
completedAt?: string;
}];
pagination: {
total: number;
limit: number;
offset: number;
nextOffset?: number;
}
},
errors: {
400: "Invalid query parameters",
401: "Unauthorized"
}
}

// Cancel a pending task
DELETE /tasks/{taskId}: {
request: {}, // Authenticated with API key
response: {
success: boolean;
cancelledAt: string;
refundAmount?: number; // TON amount refunded, if any
},
errors: {
401: "Unauthorized",
404: "Task not found",
409: "Task already completed or in progress"
}
}
}
