import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { createLogger } from '@mindburn/shared';
import { TaskStatus, Task } from '../types';

const logger = createLogger('taskWorkflow');

/**
 * Task workflow definition to export to AWS Step Functions
 */
export const taskWorkflowDefinition = {
  Comment: 'Task Distribution and Verification Workflow',
  StartAt: 'Initialize',
  States: {
    Initialize: {
      Type: 'Pass',
      Result: {
        distributionAttempts: 0,
        isDistributed: false,
        isCompleted: false,
      },
      Next: 'FindEligibleWorkers',
    },
    FindEligibleWorkers: {
      Type: 'Task',
      Resource: '${FindEligibleWorkersFunction}',
      ResultPath: '$.eligibleWorkers',
      Retry: [
        {
          ErrorEquals: ['ServiceException', 'ResourceNotFoundException'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 1.5,
        },
      ],
      Catch: [
        {
          ErrorEquals: ['States.ALL'],
          ResultPath: '$.error',
          Next: 'HandleDistributionFailure',
        },
      ],
      Next: 'CheckEligibleWorkers',
    },
    CheckEligibleWorkers: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.eligibleWorkers.count',
          NumericEquals: 0,
          Next: 'HandleNoEligibleWorkers',
        },
      ],
      Default: 'DistributeTask',
    },
    DistributeTask: {
      Type: 'Task',
      Resource: '${DistributeTaskFunction}',
      ResultPath: '$.distribution',
      Retry: [
        {
          ErrorEquals: ['ServiceException', 'ThrottlingException'],
          IntervalSeconds: 1,
          MaxAttempts: 3,
          BackoffRate: 2.0,
        },
      ],
      Catch: [
        {
          ErrorEquals: ['States.ALL'],
          ResultPath: '$.error',
          Next: 'HandleDistributionFailure',
        },
      ],
      Next: 'WaitForTaskCompletion',
    },
    WaitForTaskCompletion: {
      Type: 'Wait',
      SecondsPath: '$.waitTime',
      Next: 'CheckTaskStatus',
    },
    CheckTaskStatus: {
      Type: 'Task',
      Resource: '${CheckTaskStatusFunction}',
      ResultPath: '$.taskStatus',
      Retry: [
        {
          ErrorEquals: ['ServiceException'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 1.5,
        },
      ],
      Next: 'EvaluateTaskStatus',
    },
    EvaluateTaskStatus: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.taskStatus.status',
          StringEquals: 'COMPLETED',
          Next: 'TaskCompleted',
        },
        {
          Variable: '$.taskStatus.status',
          StringEquals: 'FAILED',
          Next: 'TaskFailed',
        },
        {
          Variable: '$.taskStatus.status',
          StringEquals: 'CANCELLED',
          Next: 'TaskCancelled',
        },
        {
          Variable: '$.taskStatus.isExpired',
          BooleanEquals: true,
          Next: 'HandleExpiredTask',
        },
        {
          Variable: '$.taskStatus.needsRedistribution',
          BooleanEquals: true,
          Next: 'IncrementDistributionAttempts',
        },
      ],
      Default: 'WaitForTaskCompletion',
    },
    IncrementDistributionAttempts: {
      Type: 'Pass',
      ResultPath: '$.distributionAttempts',
      Parameters: {
        'count.$': 'States.MathAdd($.distributionAttempts.count, 1)',
      },
      Next: 'CheckDistributionAttempts',
    },
    CheckDistributionAttempts: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.distributionAttempts.count',
          NumericGreaterThan: 3,
          Next: 'HandleDistributionFailure',
        },
      ],
      Default: 'FindEligibleWorkers',
    },
    HandleNoEligibleWorkers: {
      Type: 'Task',
      Resource: '${HandleNoEligibleWorkersFunction}',
      Next: 'Wait',
    },
    Wait: {
      Type: 'Wait',
      Seconds: 300, // 5 minutes
      Next: 'FindEligibleWorkers',
    },
    HandleDistributionFailure: {
      Type: 'Task',
      Resource: '${HandleDistributionFailureFunction}',
      End: true,
    },
    HandleExpiredTask: {
      Type: 'Task',
      Resource: '${HandleExpiredTaskFunction}',
      End: true,
    },
    TaskCompleted: {
      Type: 'Task',
      Resource: '${TaskCompletedFunction}',
      End: true,
    },
    TaskFailed: {
      Type: 'Task',
      Resource: '${TaskFailedFunction}',
      End: true,
    },
    TaskCancelled: {
      Type: 'Task',
      Resource: '${TaskCancelledFunction}',
      End: true,
    },
  },
};

/**
 * Generate complete Step Functions workflow definition with actual Lambda ARNs
 */
export function generateWorkflowDefinition(lambdaArns: Record<string, string>): any {
  // Clone definition to avoid modifying the original
  const definition = JSON.parse(JSON.stringify(taskWorkflowDefinition));
  
  // Replace placeholders with actual Lambda ARNs
  const definitionString = JSON.stringify(definition);
  const populatedDefinition = definitionString.replace(
    /\${([^}]+)}/g,
    (match, functionName) => {
      return lambdaArns[functionName] || match;
    }
  );
  
  return JSON.parse(populatedDefinition);
}

/**
 * Helper function to start a task workflow execution
 */
export async function startTaskWorkflow(
  taskId: string,
  taskInput: any,
  stateMachineArn: string
): Promise<string> {
  const sfn = new SFNClient({});
  
  try {
    const command = new StartExecutionCommand({
      stateMachineArn,
      name: `task-${taskId}`,
      input: JSON.stringify({
        taskId,
        ...taskInput,
        waitTime: 60, // Default wait time 60 seconds
      }),
    });
    
    const response = await sfn.send(command);
    logger.info('Started task workflow', { taskId, executionArn: response.executionArn });
    
    return response.executionArn!;
  } catch (error) {
    logger.error('Failed to start task workflow', { error, taskId });
    throw error;
  }
} 