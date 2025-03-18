3. Task Management System API Contracts
   3.1 Task Manager Service (Internal API)
   typescriptCopy// Task Manager Service API
   interface TaskManagerAPI {
   // Create a new verification task (internal)
   createTask: {
   request: {
   developerId: string;
   contentType: string;
   contentLocation: string; // S3 URI
   contentHash: string; // SHA-256 hash
   verificationRequirements: {
   type: string;
   customInstructions?: string;
   urgency: string;
   minVerifierLevel?: number;
   requiredVerifications: number;
   };
   callbackUrl?: string;
   },
   response: {
   taskId: string;
   status: "pending";
   estimatedCompletionTime: string;
   createdAt: string;
   },
   errors: {
   400: "Invalid task data",
   500: "Internal service error"
   }
   }

// Update task status (internal)
updateTaskStatus: {
request: {
taskId: string;
status: "pending" | "in_progress" | "completed" | "failed";
updateData?: {
assignedVerifiers?: string[];
verificationProgress?: number;
results?: {
status: string;
confidence: number;
explanations: string[];
verificationCount: number;
verifierLevels: number[];
};
failureReason?: string;
}
},
response: {
taskId: string;
status: string;
updatedAt: string;
},
errors: {
404: "Task not found",
409: "Invalid status transition",
500: "Internal service error"
}
}

// Get task details (internal)
getTaskDetails: {
request: {
taskId: string;
},
response: {
taskId: string;
developerId: string;
contentType: string;
contentLocation: string;
contentHash: string;
verificationRequirements: {
type: string;
customInstructions?: string;
urgency: string;
minVerifierLevel?: number;
requiredVerifications: number;
};
status: string;
assignedVerifiers: string[];
verificationProgress: number;
results?: object;
createdAt: string;
updatedAt: string;
completedAt?: string;
callbackUrl?: string;
},
errors: {
404: "Task not found",
500: "Internal service error"
}
}
}
3.2 Task Distributor Service (Internal API)
typescriptCopy// Task Distributor Service API
interface TaskDistributorAPI {
// Distribute task to eligible workers
distributeTask: {
request: {
taskId: string;
},
response: {
taskId: string;
eligibleWorkers: string[];
distributionStrategy: "broadcast" | "targeted" | "auction";
notificationsSent: number;
executionId: string; // Step Function execution ID
},
errors: {
404: "Task not found",
409: "Task already distributed",
500: "Distribution failed"
}
}

// Assign task to specific worker
assignTask: {
request: {
taskId: string;
workerId: string;
},
response: {
taskId: string;
workerId: string;
assignedAt: string;
deadline: string;
success: boolean;
},
errors: {
404: "Task or worker not found",
409: "Task already assigned",
422: "Worker not eligible for task",
500: "Assignment failed"
}
}

// Reclaim task from worker (timeout/reassignment)
reclaimTask: {
request: {
taskId: string;
workerId: string;
reason: "timeout" | "worker_request" | "admin_action" | "system";
},
response: {
taskId: string;
workerId: string;
reclaimedAt: string;
success: boolean;
},
errors: {
404: "Task or worker not found",
409: "Task not assigned to worker",
500: "Reclaim failed"
}
}
}
3.3 Step Functions Workflow Definition
jsonCopy{
"Comment": "Aletheia Task Verification Workflow",
"StartAt": "Initialize",
"States": {
"Initialize": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskInitializerFunction}",
        "Payload": {
          "taskId.$": "$.taskId"
        }
      },
      "ResultPath": "$.taskDetails",
"Next": "FindEligibleWorkers"
},
"FindEligibleWorkers": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${WorkerMatchingFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "taskDetails.$": "$.taskDetails"
        }
      },
      "ResultPath": "$.workerMatching",
"Next": "EligibleWorkersFound"
},
"EligibleWorkersFound": {
"Type": "Choice",
"Choices": [
{
"Variable": "$.workerMatching.eligibleWorkersCount",
"NumericGreaterThan": 0,
"Next": "NotifyWorkers"
}
],
"Default": "HandleNoEligibleWorkers"
},
"NotifyWorkers": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${WorkerNotificationFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "eligibleWorkers.$": "$.workerMatching.eligibleWorkers",
          "distributionStrategy.$": "$.workerMatching.distributionStrategy"
        }
      },
      "ResultPath": "$.notifications",
"Next": "WaitForAssignment"
},
"WaitForAssignment": {
"Type": "Wait",
"Seconds": 300,
"Next": "CheckAssignmentStatus"
},
"CheckAssignmentStatus": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskStatusCheckerFunction}",
        "Payload": {
          "taskId.$": "$.taskId"
        }
      },
      "ResultPath": "$.assignmentStatus",
"Next": "IsTaskAssigned"
},
"IsTaskAssigned": {
"Type": "Choice",
"Choices": [
{
"Variable": "$.assignmentStatus.isAssigned",
"BooleanEquals": true,
"Next": "WaitForCompletion"
},
{
"Variable": "$.assignmentStatus.attemptCount",
"NumericGreaterThan": 3,
"Next": "HandleFailedAssignment"
}
],
"Default": "FindEligibleWorkers"
},
"WaitForCompletion": {
"Type": "Wait",
"Seconds": 900,
"Next": "CheckCompletionStatus"
},
"CheckCompletionStatus": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskStatusCheckerFunction}",
        "Payload": {
          "taskId.$": "$.taskId"
        }
      },
      "ResultPath": "$.completionStatus",
"Next": "IsTaskCompleted"
},
"IsTaskCompleted": {
"Type": "Choice",
"Choices": [
{
"Variable": "$.completionStatus.isCompleted",
"BooleanEquals": true,
"Next": "ConsolidateResults"
},
{
"Variable": "$.completionStatus.hasExpired",
"BooleanEquals": true,
"Next": "HandleExpiredTask"
}
],
"Default": "WaitForCompletion"
},
"ConsolidateResults": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${ResultConsolidationFunction}",
        "Payload": {
          "taskId.$": "$.taskId"
        }
      },
      "ResultPath": "$.consolidatedResults",
"Next": "ProcessPayment"
},
"ProcessPayment": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${PaymentProcessorFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "consolidatedResults.$": "$.consolidatedResults"
        }
      },
      "ResultPath": "$.payment",
"Next": "NotifyTaskCompletion"
},
"NotifyTaskCompletion": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskCompletionNotifierFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "taskDetails.$": "$.taskDetails",
          "consolidatedResults.$": "$.consolidatedResults"
        }
      },
      "ResultPath": "$.notification",
"End": true
},
"HandleNoEligibleWorkers": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskFailureHandlerFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "reason": "NO_ELIGIBLE_WORKERS"
        }
      },
      "ResultPath": "$.failure",
"End": true
},
"HandleFailedAssignment": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskFailureHandlerFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "reason": "ASSIGNMENT_FAILED"
        }
      },
      "ResultPath": "$.failure",
"End": true
},
"HandleExpiredTask": {
"Type": "Task",
"Resource": "arn:aws:states:::lambda:invoke",
"Parameters": {
"FunctionName": "${TaskFailureHandlerFunction}",
        "Payload": {
          "taskId.$": "$.taskId",
          "reason": "TASK_EXPIRED"
        }
      },
      "ResultPath": "$.failure",
"End": true
}
}
}
