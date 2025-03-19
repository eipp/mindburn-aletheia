import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient();
const eventBridgeClient = new EventBridgeClient();

// Environment variables
const TASKS_TABLE = process.env.TASKS_TABLE || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

export const handler = async (event: any): Promise<any> => {
  console.log('Running task scheduler:', JSON.stringify(event));
  
  try {
    // Find pending tasks that are ready to be scheduled
    const pendingTasks = await findPendingTasks();
    
    if (pendingTasks.length === 0) {
      console.log('No pending tasks to schedule');
      return { 
        statusCode: 200, 
        body: { message: 'No pending tasks to schedule' } 
      };
    }
    
    console.log(`Found ${pendingTasks.length} pending tasks to schedule`);
    
    // Schedule each task by sending events to EventBridge
    const scheduledTasks = await scheduleTasks(pendingTasks);
    
    return {
      statusCode: 200,
      body: {
        scheduledTasks: scheduledTasks.length,
        message: `Successfully scheduled ${scheduledTasks.length} tasks`
      }
    };
  } catch (error) {
    console.error('Error scheduling tasks:', error);
    return {
      statusCode: 500,
      body: { 
        message: 'Error scheduling tasks',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

/**
 * Find pending tasks that are ready to be scheduled
 */
async function findPendingTasks(): Promise<any[]> {
  // Query tasks with PENDING status
  const response = await dynamoClient.send(new QueryCommand({
    TableName: TASKS_TABLE,
    IndexName: 'StatusCreatedIndex',
    KeyConditionExpression: 'TaskStatus = :status',
    ExpressionAttributeValues: {
      ':status': { S: 'PENDING' },
    },
    Limit: 100 // Limit to 100 tasks per run
  }));
  
  // Transform DynamoDB response to plain objects
  if (response.Items && response.Items.length > 0) {
    return response.Items.map(item => {
      // Extract task ID from PK
      const taskId = item.PK.S?.replace('TASK#', '') || '';
      
      return {
        taskId,
        priority: Number(item.GSI2SK?.N || 1),
        taskType: item.TaskType?.S || 'UNKNOWN',
        content: item.Content?.M || {},
        deadline: Number(item.Deadline?.N || 0),
        createdAt: Number(item.CreatedAt?.N || 0)
      };
    });
  }
  
  return [];
}

/**
 * Schedule tasks by sending events to EventBridge
 */
async function scheduleTasks(tasks: any[]): Promise<any[]> {
  // Group tasks by type for batch processing
  const tasksByType = tasks.reduce((acc: Record<string, any[]>, task) => {
    const taskType = task.taskType || 'UNKNOWN';
    if (!acc[taskType]) {
      acc[taskType] = [];
    }
    acc[taskType].push(task);
    return acc;
  }, {});
  
  const scheduledTasks = [];
  
  // Process each task type
  for (const [taskType, taskGroup] of Object.entries(tasksByType)) {
    // Sort tasks by priority (higher values first)
    const sortedTasks = taskGroup.sort((a, b) => b.priority - a.priority);
    
    // Schedule tasks
    for (const task of sortedTasks) {
      try {
        // Send event to EventBridge
        await eventBridgeClient.send(new PutEventsCommand({
          Entries: [
            {
              EventBusName: EVENT_BUS_NAME,
              Source: 'aletheia.task-scheduler',
              DetailType: 'TaskScheduled',
              Detail: JSON.stringify({
                taskId: task.taskId,
                taskType: task.taskType,
                priority: task.priority,
                environment: ENVIRONMENT
              }),
              Time: new Date()
            }
          ]
        }));
        
        scheduledTasks.push(task);
      } catch (error) {
        console.error(`Failed to schedule task ${task.taskId}:`, error);
      }
    }
  }
  
  return scheduledTasks;
} 