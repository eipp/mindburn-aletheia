import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SQS } from '@aws-sdk/client-sqs';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus, TaskUrgency, VerificationRequirements } from '../types';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('testTaskFlow');
const dynamo = DynamoDBDocument.from(new DynamoDB({}));
const sqs = new SQS({});
const eventBridge = new EventBridge({});

/**
 * Generate a sample task for testing
 */
function generateSampleTask(): Task {
  const taskId = uuidv4();
  const now = new Date();
  
  // Create expiration time 1 hour from now
  const expirationTime = new Date(now.getTime() + 60 * 60 * 1000);
  
  return {
    taskId,
    title: 'Test Task - Verify Image Content',
    description: 'Verify if the image contains inappropriate content.',
    status: TaskStatus.CREATED,
    verificationRequirements: {
      type: 'IMAGE_VERIFICATION',
      requiredSkills: ['content-moderation', 'image-analysis'],
      minVerifierLevel: 2,
      languageCodes: ['en'],
      urgency: TaskUrgency.MEDIUM,
      verificationThreshold: 2, // Require 2 verifiers
      timeoutMinutes: 60,
    },
    metadata: {
      imageUrl: 'https://example.com/sample-image.jpg',
      categories: ['nsfw', 'violence', 'hate-speech'],
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: 'test-user',
    completedVerifications: 0,
    expiresAt: expirationTime.toISOString(),
    priority: 50, // Medium priority
    reward: 2.5,
    distributionAttempts: 0,
  };
}

/**
 * Function to simulate the task creation and distribution flow
 */
export async function simulateTaskFlow(): Promise<void> {
  try {
    // Step 1: Create a sample task
    const task = generateSampleTask();
    logger.info('Created sample task', { taskId: task.taskId });
    
    // Step 2: Store in DynamoDB
    await dynamo.put({
      TableName: process.env.TASKS_TABLE!,
      Item: task,
    });
    logger.info('Stored task in DynamoDB', { taskId: task.taskId });
    
    // Step 3: Emit TaskCreated event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME!,
          Source: 'com.mindburn.aletheia.tasks',
          DetailType: 'TaskCreated',
          Detail: JSON.stringify({
            taskId: task.taskId,
            status: task.status,
            urgency: task.verificationRequirements.urgency,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info('Emitted TaskCreated event', { taskId: task.taskId });
    
    // Step 4: Send to task distribution queue
    await sqs.sendMessage({
      QueueUrl: process.env.TASK_QUEUE_URL!,
      MessageBody: JSON.stringify({
        taskId: task.taskId,
        priority: task.priority,
      }),
      MessageAttributes: {
        taskType: {
          DataType: 'String',
          StringValue: task.verificationRequirements.type,
        },
        urgency: {
          DataType: 'String',
          StringValue: task.verificationRequirements.urgency,
        },
      },
    });
    logger.info('Sent task to distribution queue', { taskId: task.taskId });
    
    logger.info('Task flow simulation completed successfully');
    
    return;
  } catch (error) {
    logger.error('Error simulating task flow', { error });
    throw error;
  }
}

/**
 * Function to simulate task assignment to workers
 */
export async function simulateTaskAssignment(taskId: string, workerIds: string[]): Promise<void> {
  try {
    // Step 1: Update task status to PENDING_ACCEPTANCE
    await dynamo.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: 'SET #status = :status, assignedWorkers = :workers, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.PENDING_ACCEPTANCE,
        ':workers': workerIds,
        ':now': new Date().toISOString(),
      },
    });
    logger.info('Updated task status to PENDING_ACCEPTANCE', { taskId, workerCount: workerIds.length });
    
    // Step 2: Send notifications to workers
    const notificationPromises = workerIds.map(workerId => 
      sqs.sendMessage({
        QueueUrl: process.env.WORKER_NOTIFICATION_QUEUE_URL!,
        MessageBody: JSON.stringify({
          taskId,
          workerId,
          type: 'new_task',
        }),
      })
    );
    
    await Promise.all(notificationPromises);
    logger.info('Sent notifications to workers', { taskId, workerIds });
    
    // Step 3: Emit TaskAssigned event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME!,
          Source: 'com.mindburn.aletheia.tasks',
          DetailType: 'TaskAssigned',
          Detail: JSON.stringify({
            taskId,
            assignedWorkers: workerIds,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info('Emitted TaskAssigned event', { taskId });
    
    logger.info('Task assignment simulation completed successfully');
    
    return;
  } catch (error) {
    logger.error('Error simulating task assignment', { error, taskId });
    throw error;
  }
}

/**
 * Function to simulate task verification submission
 */
export async function simulateVerificationSubmission(
  taskId: string,
  workerId: string,
  isApproved: boolean
): Promise<void> {
  try {
    // Step 1: Create verification record
    const verificationId = uuidv4();
    const now = new Date().toISOString();
    
    await dynamo.put({
      TableName: process.env.VERIFICATIONS_TABLE!,
      Item: {
        verificationId,
        taskId,
        workerId,
        result: {
          isApproved,
          reason: isApproved ? 'Content appears appropriate' : 'Contains inappropriate content',
        },
        submittedAt: now,
        timeSpentSeconds: 120, // 2 minutes
      },
    });
    logger.info('Created verification record', { verificationId, taskId, workerId });
    
    // Step 2: Update task with verification count
    await dynamo.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: 'SET completedVerifications = if_not_exists(completedVerifications, :zero) + :one, updatedAt = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':now': now,
      },
    });
    logger.info('Updated task verification count', { taskId });
    
    // Step 3: Emit VerificationSubmitted event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME!,
          Source: 'com.mindburn.aletheia.verifications',
          DetailType: 'VerificationSubmitted',
          Detail: JSON.stringify({
            taskId,
            workerId,
            verificationId,
            isApproved,
            timestamp: now,
          }),
        },
      ],
    });
    logger.info('Emitted VerificationSubmitted event', { taskId, verificationId });
    
    // Step 4: Send to results processing queue
    await sqs.sendMessage({
      QueueUrl: process.env.RESULTS_PROCESSING_QUEUE_URL!,
      MessageBody: JSON.stringify({
        taskId,
        verificationId,
      }),
    });
    logger.info('Sent to results processing queue', { taskId, verificationId });
    
    logger.info('Verification submission simulation completed successfully');
    
    return;
  } catch (error) {
    logger.error('Error simulating verification submission', { error, taskId, workerId });
    throw error;
  }
}

/**
 * Function to simulate task completion
 */
export async function simulateTaskCompletion(taskId: string): Promise<void> {
  try {
    // Step 1: Get task details
    const { Item: task } = await dynamo.get({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
    });
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Step 2: Update task status to COMPLETED
    await dynamo.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.COMPLETED,
        ':now': new Date().toISOString(),
      },
    });
    logger.info('Updated task status to COMPLETED', { taskId });
    
    // Step 3: Emit TaskCompleted event
    await eventBridge.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME!,
          Source: 'com.mindburn.aletheia.tasks',
          DetailType: 'TaskCompleted',
          Detail: JSON.stringify({
            taskId,
            assignedWorkers: task.assignedWorkers || [],
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info('Emitted TaskCompleted event', { taskId });
    
    // Step 4: Send completion notifications to workers
    if (task.assignedWorkers && task.assignedWorkers.length > 0) {
      const notificationPromises = task.assignedWorkers.map(workerId => 
        sqs.sendMessage({
          QueueUrl: process.env.WORKER_NOTIFICATION_QUEUE_URL!,
          MessageBody: JSON.stringify({
            taskId,
            workerId,
            type: 'task_completed',
            metadata: {
              reward: task.reward,
              timeSpentMinutes: Math.round(Math.random() * 10 + 5), // Random time between 5-15 minutes
            },
          }),
        })
      );
      
      await Promise.all(notificationPromises);
      logger.info('Sent completion notifications to workers', { taskId, workerCount: task.assignedWorkers.length });
    }
    
    logger.info('Task completion simulation completed successfully');
    
    return;
  } catch (error) {
    logger.error('Error simulating task completion', { error, taskId });
    throw error;
  }
}

/**
 * Run the full task lifecycle simulation
 */
export async function runFullTaskSimulation(): Promise<void> {
  try {
    // Step 1: Create and distribute task
    await simulateTaskFlow();
    const task = generateSampleTask();
    
    // Step 2: Assign to sample workers
    const sampleWorkers = ['worker-1', 'worker-2', 'worker-3'];
    await simulateTaskAssignment(task.taskId, sampleWorkers);
    
    // Step 3: Submit verifications from workers
    await simulateVerificationSubmission(task.taskId, 'worker-1', true);
    await simulateVerificationSubmission(task.taskId, 'worker-2', true);
    
    // Sleep for 1 second to simulate time passing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Complete the task
    await simulateTaskCompletion(task.taskId);
    
    logger.info('Full task simulation completed successfully', { taskId: task.taskId });
    
    return;
  } catch (error) {
    logger.error('Error in full task simulation', { error });
    throw error;
  }
} 