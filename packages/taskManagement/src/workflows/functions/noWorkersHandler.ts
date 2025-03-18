import { DynamoDB, EventBridge } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('NoWorkersHandler');
const dynamodb = new DynamoDB.DocumentClient();
const eventBridge = new EventBridge();

interface NoWorkersHandlerInput {
  taskId: string;
  verificationRequirements: {
    type: string;
    requiredSkills: string[];
    minVerifierLevel: number;
    languageCodes: string[];
  };
}

interface NoWorkersHandlerOutput {
  taskId: string;
  status: TaskStatus;
  details: {
    reason: string;
    requirements: NoWorkersHandlerInput['verificationRequirements'];
    suggestions: string[];
    timestamp: string;
  };
}

export const handler = async (event: NoWorkersHandlerInput): Promise<NoWorkersHandlerOutput> => {
  try {
    logger.info('Handling no eligible workers scenario', { taskId: event.taskId });

    // Get task from DynamoDB
    const result = await dynamodb.get({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: event.taskId }
    }).promise();

    const task = result.Item as Task;
    if (!task) {
      throw new Error(`Task not found: ${event.taskId}`);
    }

    // Analyze requirements and generate suggestions
    const suggestions = await analyzeRequirements(event.verificationRequirements);

    const details = {
      reason: 'No eligible workers found for the task requirements',
      requirements: event.verificationRequirements,
      suggestions,
      timestamp: new Date().toISOString()
    };

    // Update task status
    await updateTaskStatus(task.taskId, details);

    // Emit event for monitoring and analytics
    await emitNoWorkersEvent(task.taskId, details);

    return {
      taskId: task.taskId,
      status: TaskStatus.FAILED,
      details
    };

  } catch (error) {
    logger.error('Failed to handle no workers scenario', { error, taskId: event.taskId });
    throw error;
  }
};

async function analyzeRequirements(requirements: NoWorkersHandlerInput['verificationRequirements']): Promise<string[]> {
  const suggestions: string[] = [];

  // Check skill requirements
  if (requirements.requiredSkills.length > 2) {
    suggestions.push('Consider reducing the number of required skills');
  }

  // Check verifier level
  if (requirements.minVerifierLevel > 5) {
    suggestions.push('Consider lowering the minimum verifier level requirement');
  }

  // Check language requirements
  if (requirements.languageCodes.length > 2) {
    suggestions.push('Consider reducing the number of required languages');
  }

  // Add general suggestions
  suggestions.push('Try scheduling the task during peak hours');
  suggestions.push('Consider breaking down the task into smaller subtasks');

  return suggestions;
}

async function updateTaskStatus(taskId: string, details: NoWorkersHandlerOutput['details']): Promise<void> {
  await dynamodb.update({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId },
    UpdateExpression: `
      SET #status = :status,
          noWorkersDetails = :details,
          statusReason = :reason,
          updatedAt = :now
    `,
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': TaskStatus.FAILED,
      ':details': details,
      ':reason': details.reason,
      ':now': new Date().toISOString()
    }
  }).promise();
}

async function emitNoWorkersEvent(taskId: string, details: NoWorkersHandlerOutput['details']): Promise<void> {
  await eventBridge.putEvents({
    Entries: [{
      Source: 'aletheia.task-management',
      DetailType: 'NoEligibleWorkers',
      Detail: JSON.stringify({
        taskId,
        details,
        timestamp: new Date().toISOString()
      }),
      EventBusName: process.env.EVENT_BUS_NAME
    }]
  }).promise();
} 