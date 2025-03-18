import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB, StepFunctions } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus, TaskCreationInput, VerificationRequirements } from '../types';
import { validateTaskInput } from '../utils/validation';

const logger = createLogger('taskCreationHandler');
const dynamodb = new DynamoDB.DocumentClient();
const stepFunctions = new StepFunctions();

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const taskInput: TaskCreationInput = JSON.parse(event.body || '{}');
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - Missing user ID' }),
      };
    }

    // Validate input
    const validationResult = validateTaskInput(taskInput);
    if (!validationResult.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: validationResult.errors.join(', ') }),
      };
    }

    // Create task with default values
    const task: Task = {
      taskId: uuidv4(),
      title: taskInput.title,
      description: taskInput.description,
      status: TaskStatus.CREATED,
      verificationRequirements: {
        type: taskInput.verificationRequirements.type || 'GENERAL',
        requiredSkills: taskInput.verificationRequirements.requiredSkills,
        minVerifierLevel: taskInput.verificationRequirements.minVerifierLevel,
        languageCodes: taskInput.verificationRequirements.languageCodes,
        urgency: taskInput.verificationRequirements.urgency,
        verificationThreshold: taskInput.verificationRequirements.verificationThreshold,
        timeoutMinutes: taskInput.verificationRequirements.timeoutMinutes,
      },
      metadata: taskInput.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      completedVerifications: 0,
    };

    // Calculate expiration time
    if (task.verificationRequirements.timeoutMinutes) {
      const expirationTime = new Date();
      expirationTime.setMinutes(
        expirationTime.getMinutes() + task.verificationRequirements.timeoutMinutes
      );
      task.expiresAt = expirationTime.toISOString();
    }

    // Store task in DynamoDB
    await dynamodb
      .put({
        TableName: process.env.TASKS_TABLE!,
        Item: task,
        ConditionExpression: 'attribute_not_exists(taskId)',
      })
      .promise();

    // Start Step Functions workflow
    const workflowInput = {
      taskId: task.taskId,
      verificationRequirements: task.verificationRequirements,
      expiresAt: task.expiresAt,
    };

    await stepFunctions
      .startExecution({
        stateMachineArn: process.env.TASK_WORKFLOW_STATE_MACHINE_ARN!,
        name: `task-${task.taskId}`,
        input: JSON.stringify(workflowInput),
      })
      .promise();

    logger.info('Task created successfully', { taskId: task.taskId });

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Task created successfully',
        task,
      }),
    };
  } catch (error) {
    logger.error('Failed to create task', { error });

    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Task ID already exists' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
