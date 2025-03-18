4. Worker Interface API Contracts
   4.1 Telegram Bot API Integration
   typescriptCopy// Telegram Bot Commands and Handlers
   interface TelegramBotHandlers {
   // Start command handler
   handleStart: {
   command: "/start",
   action: (ctx) => {
   // Welcome message and registration prompt
   // Link to Mini App for full experience
   }
   }

// Registration handler
handleRegistration: {
action: (ctx) => {
// Collect basic user information
// Create worker profile
// Link Telegram account to worker
}
}

// Profile command handler
handleProfile: {
command: "/profile",
action: (ctx) => {
// Display worker profile
// Show statistics and earnings
// Provide options to update profile
}
}

// Tasks command handler
handleTasks: {
command: "/tasks",
action: (ctx) => {
// Show available tasks
// Allow task acceptance
// Link to Mini App for task completion
}
}

// Wallet command handler
handleWallet: {
command: "/wallet",
action: (ctx) => {
// Show wallet balance
// Provide TON wallet connection option
// Display withdrawal options
}
}

// Accept task handler
handleAcceptTask: {
action: (ctx, taskId) => {
// Assign task to worker
// Provide task details
// Link to Mini App for task completion
}
}

// Task notification handler
sendTaskNotification: {
action: (workerId, task) => {
// Send notification about new available task
// Include basic task details and reward
// Provide accept button
}
}
}
4.2 Telegram Mini App API Integration
typescriptCopy// Telegram Mini App Integration API
interface TelegramMiniAppAPI {
// Initialize Mini App
initializeMiniApp: {
request: {
initData: string; // Telegram init data
},
response: {
worker: {
workerId: string;
displayName: string;
level: number;
skills: string[];
balance: number;
taskStats: {
completed: number;
accuracy: number;
}
},
authToken: string; // JWT for internal API requests
},
errors: {
400: "Invalid init data",
401: "Unauthorized",
403: "Worker account required"
}
}

// Get available tasks
getAvailableTasks: {
request: {
workerId: string;
limit?: number;
offset?: number;
},
response: {
tasks: [{
taskId: string;
type: string;
contentType: string;
reward: number;
estimatedTime: number;
priority: "low" | "medium" | "high";
}];
pagination: {
total: number;
limit: number;
offset: number;
nextOffset?: number;
}
},
errors: {
401: "Unauthorized"
}
}

// Get worker's in-progress tasks
getInProgressTasks: {
request: {
workerId: string;
},
response: {
tasks: [{
taskId: string;
type: string;
contentType: string;
reward: number;
acceptedAt: string;
deadline: string;
timeRemaining: number; // In seconds
}]
},
errors: {
401: "Unauthorized"
}
}

// Get worker's completed tasks
getCompletedTasks: {
request: {
workerId: string;
limit?: number;
offset?: number;
},
response: {
tasks: [{
taskId: string;
type: string;
contentType: string;
reward: number;
completedAt: string;
status: "approved" | "rejected" | "pending_review";
}];
pagination: {
total: number;
limit: number;
offset: number;
nextOffset?: number;
}
},
errors: {
401: "Unauthorized"
}
}

// Accept a task
acceptTask: {
request: {
workerId: string;
taskId: string;
},
response: {
taskId: string;
acceptedAt: string;
deadline: string;
taskDetails: {
type: string;
contentType: string;
contentUrl: string;
instructions: string;
verificationForm: {
fields: [{
id: string;
type: "radio" | "checkbox" | "text" | "select";
label: string;
required: boolean;
options?: string[];
}]
}
}
},
errors: {
401: "Unauthorized",
404: "Task not found",
409: "Task already assigned",
422: "Worker not eligible for task"
}
}

// Submit task verification
submitVerification: {
request: {
workerId: string;
taskId: string;
responses: {
[fieldId: string]: string | string[] | boolean;
};
confidence?: number; // Worker's confidence in their assessment (0.0-1.0)
timeSpent: number; // Time spent in seconds
},
response: {
taskId: string;
submittedAt: string;
status: "pending_review" | "approved";
reward: number;
newBalance: number;
paymentStatus: "processed" | "pending" | "failed";
qualityScore?: number;
},
errors: {
400: "Invalid submission data",
401: "Unauthorized",
404: "Task not found",
409: "Task already submitted or expired"
}
}

// Get worker's balance and payment history
getWorkerPayments: {
request: {
workerId: string;
limit?: number;
offset?: number;
},
response: {
currentBalance: number;
pendingBalance: number;
totalEarned: number;
payments: [{
id: string;
amount: number;
type: "task_reward" | "bonus" | "withdrawal";
status: "completed" | "pending" | "failed";
timestamp: string;
taskId?: string;
transactionHash?: string;
}];
pagination: {
total: number;
limit: number;
offset: number;
nextOffset?: number;
}
},
errors: {
401: "Unauthorized"
}
}

// Request payment withdrawal
requestWithdrawal: {
request: {
workerId: string;
amount: number;
walletAddress: string;
},
response: {
withdrawalId: string;
amount: number;
fee: number;
netAmount: number;
status: "pending";
estimatedCompletionTime: string;
requestedAt: string;
},
errors: {
400: "Invalid amount",
401: "Unauthorized",
402: "Insufficient balance",
422: "Invalid wallet address"
}
}
}
4.3 Worker Management Service (Internal API)
typescriptCopy// Worker Management Service API
interface WorkerManagementAPI {
// Create or update worker profile
upsertWorker: {
request: {
telegramId: string;
displayName: string;
languageCodes: string[];
skills?: string[];
availability?: {
status: "active" | "inactive" | "busy";
schedule?: [{
dayOfWeek: number; // 0-6, Sunday is 0
startHour: number; // 0-23
endHour: number; // 0-23
}]
}
},
response: {
workerId: string;
telegramId: string;
displayName: string;
level: number; // Calculated expertise level
skills: string[];
createdAt: string;
updatedAt: string;
},
errors: {
400: "Invalid worker data",
500: "Service error"
}
}

// Get worker profile
getWorker: {
request: {
workerId: string;
},
response: {
workerId: string;
telegramId: string;
displayName: string;
level: number;
skills: string[];
languageCodes: string[];
availability: {
status: string;
schedule?: object[];
};
statistics: {
tasksCompleted: number;
accuracyRate: number;
averageResponseTime: number;
taskBreakdown: {
[taskType: string]: number;
}
};
createdAt: string;
updatedAt: string;
lastActiveAt: string;
},
errors: {
404: "Worker not found",
500: "Service error"
}
}

// Update worker skills assessment
updateWorkerSkills: {
request: {
workerId: string;
skills: {
[skillName: string]: number; // Skill level 1-5
}
},
response: {
workerId: string;
skills: {
[skillName: string]: number;
};
level: number; // Recalculated overall level
updatedAt: string;
},
errors: {
404: "Worker not found",
500: "Service error"
}
}

// Update worker accuracy rating
updateWorkerAccuracy: {
request: {
workerId: string;
taskId: string;
accuracyScore: number; // 0.0 to 1.0
taskType: string;
},
response: {
workerId: string;
newAccuracyRate: number;
taskTypeAccuracy: {
[taskType: string]: number;
};
updatedAt: string;
},
errors: {
404: "Worker not found",
500: "Service error"
}
}

// Find eligible workers for task
findEligibleWorkers: {
request: {
taskId: string;
requiredSkills: string[];
minLevel?: number;
languageCodes?: string[];
maxWorkers?: number;
},
response: {
eligibleWorkers: [{
workerId: string;
matchScore: number; // 0.0 to 1.0
skills: {
[skillName: string]: number;
};
level: number;
availabilityStatus: string;
}];
totalEligible: number;
},
errors: {
400: "Invalid request parameters",
500: "Service error"
}
}
}
