import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient();
const eventBridgeClient = new EventBridgeClient();

// Environment variables
const TASKS_TABLE = process.env.TASKS_TABLE || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Configuration
const STALLED_TASK_THRESHOLD_MINUTES = 60; // 1 hour
const MAX_TASKS_TO_PROCESS = 100;

export const handler = async (event: any): Promise<any> => {
  console.log('Running stalled task handler:', JSON.stringify(event));
  
  try {
    // Find stalled tasks
    const stalledTasks = await findStalledTasks();
    
    if (stalledTasks.length === 0) {
      console.log('No stalled tasks found');
      return { 
        statusCode: 200, 
        body: { message: 'No stalled tasks found' } 
      };
    }
    
    console.log(`Found ${stalledTasks.length} stalled tasks`);
    
    // Process stalled tasks
    const processedTasks = await processStalledTasks(stalledTasks);
    
    return {
      statusCode: 200,
      body: {
        processedTasks: processedTasks.length,
        message: `Successfully processed ${processedTasks.length} stalled tasks`
      }
    };
  } catch (error) {
    console.error('Error processing stalled tasks:', error);
    return {
      statusCode: 500,
      body: { 
        message: 'Error processing stalled tasks',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

/**
 * Find tasks that have been in the IN_PROGRESS state for too long
 */
async function findStalledTasks(): Promise<any[]> {
  // Calculate the timestamp threshold for stalled tasks
  const thresholdTime = Date.now() - (STALLED_TASK_THRESHOLD_MINUTES * 60 * 1000);
  
  // Query tasks with IN_PROGRESS status
  const response = await dynamoClient.send(new QueryCommand({
    TableName: TASKS_TABLE,
    IndexName: 'StatusCreatedIndex',
    KeyConditionExpression: 'TaskStatus = :status',
    FilterExpression: 'UpdatedAt < :threshold',
    ExpressionAttributeValues: {
      ':status': { S: 'IN_PROGRESS' },
      ':threshold': { N: thresholdTime.toString() },
    },
    Limit: MAX_TASKS_TO_PROCESS
  }));
  
  // Transform DynamoDB response to plain objects
  if (response.Items && response.Items.length > 0) {
    return response.Items.map(item => {
      // Extract task ID from PK
      const taskId = item.PK.S?.replace('TASK#', '') || '';
      // Extract worker ID from assignment if it exists
      const workerId = item.SK.S?.startsWith('WORKER#') 
        ? item.SK.S.replace('WORKER#', '') 
        : undefined;
      
      return {
        taskId,
        workerId,
        updatedAt: Number(item.UpdatedAt?.N || 0),
        status: item.TaskStatus?.S,
        priority: Number(item.GSI2SK?.N || 1),
        taskType: item.TaskType?.S || 'UNKNOWN',
      };
    });
  }
  
  return [];
}

/**
 * Process stalled tasks by resetting them to PENDING status
 */
async function processStalledTasks(tasks: any[]): Promise<any[]> {
  const processedTasks = [];
  
  for (const task of tasks) {
    try {
      // Update task status back to PENDING
      await dynamoClient.send(new UpdateItemCommand({
        TableName: TASKS_TABLE,
        Key: {
          PK: { S: `TASK#${task.taskId}` },
          SK: { S: 'METADATA' }
        },
        UpdateExpression: 'SET TaskStatus = :status, UpdatedAt = :now, RetriedAt = :now, RetryCount = if_not_exists(RetryCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':status': { S: 'PENDING' },
          ':now': { N: Date.now().toString() },
          ':zero': { N: '0' },
          ':one': { N: '1' }
        },
        ReturnValues: 'UPDATED_NEW'
      }));
      
      // Send task reset event
      await eventBridgeClient.send(new PutEventsCommand({
        Entries: [
          {
            EventBusName: EVENT_BUS_NAME,
            Source: 'aletheia.task-handler',
            DetailType: 'TaskReset',
            Detail: JSON.stringify({
              taskId: task.taskId,
              previousStatus: 'IN_PROGRESS',
              newStatus: 'PENDING',
              reason: 'STALLED',
              workerId: task.workerId,
              environment: ENVIRONMENT
            }),
            Time: new Date()
          }
        ]
      }));
      
      processedTasks.push({
        taskId: task.taskId,
        action: 'RESET',
        newStatus: 'PENDING'
      });
    } catch (error) {
      console.error(`Failed to process stalled task ${task.taskId}:`, error);
    }
  }
  
  return processedTasks;
} 