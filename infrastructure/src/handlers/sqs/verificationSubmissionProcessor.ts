import { SQSEvent, SQSRecord, SQSHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// Initialize clients
const dynamoClient = new DynamoDBClient();
const snsClient = new SNSClient();
const eventBridgeClient = new EventBridgeClient();

// Environment variables
const QUEUE_URL = process.env.QUEUE_URL || '';
const TASKS_TABLE = process.env.TASKS_TABLE || 'aletheia-dev-tasks';
const WORKERS_TABLE = process.env.WORKERS_TABLE || 'aletheia-dev-workers';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';
const STAGE = process.env.STAGE || 'dev';

/**
 * Process messages from the verification submission queue
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log(`Received ${event.Records.length} messages from verification submission queue`);
  
  // Track failed batch items
  const batchItemFailures: { itemIdentifier: string }[] = [];
  
  // Process each message
  for (const record of event.Records) {
    try {
      await processVerificationSubmission(record);
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
 * Process an individual verification submission
 */
async function processVerificationSubmission(record: SQSRecord): Promise<void> {
  // Parse the message body
  const submission = JSON.parse(record.body);
  console.log('Processing verification submission:', submission);
  
  // Extract submission details
  const { taskId, workerId, responses, confidence, timeSpent } = submission;
  
  if (!taskId || !workerId) {
    throw new Error('Missing taskId or workerId in verification submission');
  }
  
  // Get task details
  const taskDetails = await getTaskDetails(taskId);
  
  // Update task status to VERIFIED
  await updateTaskStatus(taskId, 'VERIFIED');
  
  // Store verification result
  await storeVerificationResult(taskId, workerId, responses, confidence, timeSpent);
  
  // Update worker stats
  await updateWorkerStats(workerId, timeSpent);
  
  // Send verification completed event
  await sendVerificationCompletedEvent(taskId, workerId, taskDetails);
  
  console.log(`Successfully processed verification submission for task ${taskId} by worker ${workerId}`);
}

/**
 * Get task details from DynamoDB
 */
async function getTaskDetails(taskId: string): Promise<any> {
  const response = await dynamoClient.send(new GetItemCommand({
    TableName: TASKS_TABLE,
    Key: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: 'METADATA' },
    },
  }));
  
  if (!response.Item) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  return response.Item;
}

/**
 * Update task status in DynamoDB
 */
async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const now = Date.now();
  
  await dynamoClient.send(new UpdateItemCommand({
    TableName: TASKS_TABLE,
    Key: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: 'METADATA' },
    },
    UpdateExpression: 'SET TaskStatus = :status, UpdatedAt = :updatedAt, VerifiedAt = :verifiedAt',
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':updatedAt': { N: now.toString() },
      ':verifiedAt': { N: now.toString() },
    },
  }));
}

/**
 * Store verification result in DynamoDB
 */
async function storeVerificationResult(
  taskId: string,
  workerId: string,
  responses: Record<string, any>,
  confidence: number = 0.0,
  timeSpent: number = 0
): Promise<void> {
  const now = Date.now();
  
  await dynamoClient.send(new UpdateItemCommand({
    TableName: TASKS_TABLE,
    Key: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: `VERIFICATION#${workerId}` },
    },
    UpdateExpression: 'SET Responses = :responses, Confidence = :confidence, ' +
                      'TimeSpent = :timeSpent, CreatedAt = :createdAt, ' + 
                      'GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
    ExpressionAttributeValues: {
      ':responses': { M: mapResponsesToDynamoFormat(responses) },
      ':confidence': { N: confidence.toString() },
      ':timeSpent': { N: timeSpent.toString() },
      ':createdAt': { N: now.toString() },
      ':gsi1pk': { S: `WORKER#${workerId}` },
      ':gsi1sk': { S: `VERIFICATION#${now}` },
    },
  }));
}

/**
 * Update worker statistics after verification submission
 */
async function updateWorkerStats(workerId: string, timeSpent: number): Promise<void> {
  await dynamoClient.send(new UpdateItemCommand({
    TableName: WORKERS_TABLE,
    Key: {
      PK: { S: `WORKER#${workerId}` },
      SK: { S: 'METADATA' },
    },
    UpdateExpression: 'SET TasksCompleted = if_not_exists(TasksCompleted, :zero) + :one, ' +
                      'TotalTimeSpent = if_not_exists(TotalTimeSpent, :zero) + :timeSpent, ' +
                      'UpdatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':zero': { N: '0' },
      ':one': { N: '1' },
      ':timeSpent': { N: timeSpent.toString() },
      ':updatedAt': { N: Date.now().toString() },
    },
  }));
}

/**
 * Send verification completed event to EventBridge
 */
async function sendVerificationCompletedEvent(
  taskId: string,
  workerId: string,
  taskDetails: any
): Promise<void> {
  if (!EVENT_BUS_NAME) {
    console.log('No EVENT_BUS_NAME defined, skipping event publication');
    return;
  }
  
  const companyId = taskDetails.GSI1PK?.S?.replace('COMPANY#', '');
  const taskType = taskDetails.TaskType?.S;
  
  await eventBridgeClient.send(new PutEventsCommand({
    Entries: [
      {
        EventBusName: EVENT_BUS_NAME,
        Source: 'aletheia.verification',
        DetailType: 'verification.completed',
        Detail: JSON.stringify({
          taskId,
          workerId,
          companyId,
          taskType,
          timestamp: new Date().toISOString(),
          environment: STAGE,
        }),
        Time: new Date(),
      },
    ],
  }));
}

/**
 * Convert response objects to DynamoDB format
 */
function mapResponsesToDynamoFormat(responses: Record<string, any>): Record<string, any> {
  const dynamoResponses: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(responses)) {
    if (typeof value === 'string') {
      dynamoResponses[key] = { S: value };
    } else if (typeof value === 'number') {
      dynamoResponses[key] = { N: value.toString() };
    } else if (typeof value === 'boolean') {
      dynamoResponses[key] = { BOOL: value };
    } else if (Array.isArray(value)) {
      if (value.every(item => typeof item === 'string')) {
        dynamoResponses[key] = { SS: value };
      } else {
        dynamoResponses[key] = { L: value.map(mapValueToDynamoFormat) };
      }
    } else if (value === null) {
      dynamoResponses[key] = { NULL: true };
    } else if (typeof value === 'object') {
      dynamoResponses[key] = { M: mapResponsesToDynamoFormat(value) };
    }
  }
  
  return dynamoResponses;
}

/**
 * Map a single value to DynamoDB format
 */
function mapValueToDynamoFormat(value: any): any {
  if (typeof value === 'string') {
    return { S: value };
  } else if (typeof value === 'number') {
    return { N: value.toString() };
  } else if (typeof value === 'boolean') {
    return { BOOL: value };
  } else if (value === null) {
    return { NULL: true };
  } else if (typeof value === 'object') {
    return { M: mapResponsesToDynamoFormat(value) };
  }
  
  return { S: String(value) };
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
      subject: `[${STAGE.toUpperCase()}] Verification Submission Error`,
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