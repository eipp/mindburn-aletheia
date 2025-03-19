Webhook Configuration API
typescriptCopy// Webhook Configuration
interface WebhookAPI {
// Register a webhook endpoint
POST /webhooks: {
request: {
url: string;
events: Array<"task.created" | "task.in_progress" | "task.completed" | "task.failed">;
secret: string; // For webhook signature verification
description?: string;
},
response: {
webhookId: string;
url: string;
events: string[];
createdAt: string;
status: "active";
},
errors: {
400: "Invalid request data",
401: "Unauthorized",
409: "Webhook URL already registered"
}
}

// List registered webhooks
GET /webhooks: {
request: {}, // Authenticated with JWT
response: {
webhooks: [{
webhookId: string;
url: string;
events: string[];
createdAt: string;
lastTriggeredAt?: string;
status: "active" | "failed";
failureCount: number;
}]
},
errors: {
401: "Unauthorized"
}
}

// Update webhook configuration
PATCH /webhooks/{webhookId}: {
request: {
url?: string;
events?: string[];
secret?: string;
description?: string;
status?: "active" | "paused";
},
response: {
webhookId: string;
url: string;
events: string[];
updatedAt: string;
status: "active" | "paused";
},
errors: {
400: "Invalid request data",
401: "Unauthorized",
404: "Webhook not found"
}
}

// Delete a webhook
DELETE /webhooks/{webhookId}: {
request: {}, // Authenticated with JWT
response: {
success: boolean;
deletedAt: string;
},
errors: {
401: "Unauthorized",
404: "Webhook not found"
}
}

// Test a webhook
POST /webhooks/{webhookId}/test: {
request: {}, // Authenticated with JWT
response: {
success: boolean;
requestId: string;
sentAt: string;
},
errors: {
401: "Unauthorized",
404: "Webhook not found"
}
}
}
2.2 Analytics API
typescriptCopy// Analytics API for the Developer Dashboard
interface AnalyticsAPI {
// Get verification task statistics
GET /analytics/tasks: {
request: {
startDate: string; // ISO date
endDate: string; // ISO date
interval?: "hourly" | "daily" | "weekly" | "monthly";
},
response: {
totalTasks: number;
completedTasks: number;
averageCompletionTime: number; // In seconds
timePoints: [{
timestamp: string;
taskCount: number;
completionRate: number;
averageConfidence: number;
}]
},
errors: {
400: "Invalid date range",
401: "Unauthorized"
}
}

// Get verification results breakdown
GET /analytics/results: {
request: {
startDate: string; // ISO date
endDate: string; // ISO date
taskType?: string;
},
response: {
resultBreakdown: [{
status: string;
count: number;
percentage: number;
}];
confidenceDistribution: [{
range: string; // e.g., "0.0-0.1", "0.1-0.2", etc.
count: number;
}];
averageConfidence: number;
},
errors: {
400: "Invalid parameters",
401: "Unauthorized"
}
}

// Get billing and usage information
GET /analytics/billing: {
request: {
startDate: string; // ISO date
endDate: string; // ISO date
},
response: {
totalSpend: number;
taskCosts: number;
taskCount: number;
costBreakdown: [{
taskType: string;
count: number;
cost: number;
}];
dailySpend: [{
date: string;
amount: number;
}]
},
errors: {
400: "Invalid date range",
401: "Unauthorized"
}
}
}
2.3 Webhook Payload Formats
typescriptCopy// Webhook Event Payloads
interface WebhookPayloads {
// Common fields across all webhook events
commonFields: {
eventId: string;
eventType: string;
timestamp: string;
developerId: string;
signature: string; // HMAC-SHA256 of payload using webhook secret
}

// Task created event
"task.created": {
eventId: string;
eventType: "task.created";
timestamp: string;
developerId: string;
signature: string;
data: {
taskId: string;
contentType: string;
verificationRequirements: {
type: string;
urgency: string;
requiredVerifications: number;
};
estimatedCompletionTime: string;
createdAt: string;
}
}

// Task in progress event
"task.in_progress": {
eventId: string;
eventType: "task.in_progress";
timestamp: string;
developerId: string;
signature: string;
data: {
taskId: string;
assignedVerifiers: number;
verificationProgress: number; // 0.0 to 1.0
estimatedCompletionTime: string;
updatedAt: string;
}
}

// Task completed event
"task.completed": {
eventId: string;
eventType: "task.completed";
timestamp: string;
developerId: string;
signature: string;
data: {
taskId: string;
results: {
status: string;
confidence: number;
explanations: string[];
verificationCount: number;
verifierLevels: number[];
};
completedAt: string;
}
}

// Task failed event
"task.failed": {
eventId: string;
eventType: "task.failed";
timestamp: string;
developerId: string;
signature: string;
data: {
taskId: string;
reason: string;
failedAt: string;
}
}
}
