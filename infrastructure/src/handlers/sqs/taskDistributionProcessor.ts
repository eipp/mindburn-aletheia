import { SQSEvent, SQSRecord, SQSHandler } from 'aws-lambda';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Initialize clients
const sqsClient = new SQSClient();
const dynamoClient = new DynamoDBClient();
const snsClient = new SNSClient();

// Environment variables
const QUEUE_URL = process.env.QUEUE_URL || '';
const TASKS_TABLE = process.env.TASKS_TABLE || 'aletheia-dev-tasks';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const STAGE = process.env.STAGE || 'dev';

/**
 * Process messages from the task distribution queue
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log(`Received ${event.Records.length} messages from task distribution queue`);
  
  // Track failed batch items
  const batchItemFailures: { itemIdentifier: string }[] = [];
  
  // Process each message
  for (const record of event.Records) {
    try {
      await processTaskDistributionMessage(record);
    } catch (error) {
      console.error(`Error processing message ${record.messageId}:`, error);
      // Add to failure list for partial batch failures
      batchItemFailures.push({ itemIdentifier: record.messageId });
      
      // Send alert for critical errors
      if (ALERT_TOPIC_ARN && isCriticalError(error)) {
        await sendErrorAlert(record, error);
      }
    }
  }
  
  // Return failed batch items
  return {
    batchItemFailures,
  };
};

/**
 * Process an individual task distribution message
 */
async function processTaskDistributionMessage(record: SQSRecord): Promise<void> {
  // Parse the message body
  const message = JSON.parse(record.body);
  console.log('Processing task distribution message:', message);
  
  // Extract task information
  const { taskId, workerId, taskAssignedAt } = message;
  
  if (!taskId) {
    throw new Error('Missing taskId in message');
  }
  
  // Update task status in DynamoDB
  await updateTaskStatus(taskId, workerId, taskAssignedAt);
  
  // If a worker is assigned, create an assignment record
  if (workerId) {
    await createTaskAssignment(taskId, workerId, taskAssignedAt);
  }
  
  console.log(`Successfully processed task distribution for task ${taskId}`);
}

/**
 * Update task status in DynamoDB
 */
async function updateTaskStatus(
  taskId: string,
  workerId?: string,
  taskAssignedAt?: number
): Promise<void> {
  // Prepare the update expression based on whether the task is assigned to a worker
  const status = workerId ? 'ASSIGNED' : 'PENDING';
  const now = Date.now();
  
  const updateExpression = workerId
    ? 'SET TaskStatus = :status, AssignedWorkerId = :workerId, AssignedAt = :assignedAt, UpdatedAt = :updatedAt'
    : 'SET TaskStatus = :status, UpdatedAt = :updatedAt';
    
  const expressionAttrValues: Record<string, any> = {
    ':status': { S: status },
    ':updatedAt': { N: now.toString() },
  };
  
  if (workerId) {
    expressionAttrValues[':workerId'] = { S: workerId };
    expressionAttrValues[':assignedAt'] = { N: (taskAssignedAt || now).toString() };
  }
  
  // Update the task item
  await dynamoClient.send(new UpdateItemCommand({
    TableName: TASKS_TABLE,
    Key: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: 'METADATA' },
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttrValues,
  }));
}

/**
 * Create task assignment record in DynamoDB
 */
async function createTaskAssignment(
  taskId: string,
  workerId: string,
  assignedAt: number = Date.now()
): Promise<void> {
  // Update the task item with a worker assignment
  await dynamoClient.send(new UpdateItemCommand({
    TableName: TASKS_TABLE,
    Key: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: `WORKER#${workerId}` },
    },
    UpdateExpression: 'SET AssignedAt = :assignedAt, Status = :status, GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
    ExpressionAttributeValues: {
      ':assignedAt': { N: assignedAt.toString() },
      ':status': { S: 'ASSIGNED' },
      ':gsi1pk': { S: `WORKER#${workerId}` },
      ':gsi1sk': { S: `TASK#${assignedAt}` },
    },
  }));
}

/**
 * Determine if an error is critical
 */
function isCriticalError(error: any): boolean {
  // Consider any DynamoDB or authentication errors as critical
  const errorMessage = error?.message || '';
  return (
    errorMessage.includes('AccessDeni') ||
    errorMessage.includes('Authentication') ||
    errorMessage.includes('Provision') ||
    errorMessage.includes('ThrottlingException') ||
    errorMessage.includes('Internal Server Error')
  );
}

/**
 * Send an alert for critical errors
 */
async function sendErrorAlert(record: SQSRecord, error: any): Promise<void> {
  try {
    const errorMessage = error?.message || 'Unknown error';
    const message = {
      subject: `[${STAGE.toUpperCase()}] Task Distribution Error`,
      messageId: record.messageId,
      body: record.body,
      errorMessage,
      timestamp: new Date().toISOString(),
      stage: STAGE,
      queueUrl: QUEUE_URL,
    };
    
    await snsClient.send(new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: message.subject,
      Message: JSON.stringify(message, null, 2),
    }));
  } catch (alertError) {
    console.error('Error sending alert:', alertError);
  }
} 