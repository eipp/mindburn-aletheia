import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { LambdaClient } from '@aws-sdk/client-lambda';

const region = process.env.AWS_REGION || 'us-east-1';

// Initialize DynamoDB clients
const ddbClient = new DynamoDBClient({ region });
export const docClient = DynamoDBDocumentClient.from(ddbClient);

// Initialize SQS client
export const sqsClient = new SQSClient({ region });

// Initialize Lambda client
export const lambdaClient = new LambdaClient({ region });

export const TableNames = {
  USERS: `aletheia-${process.env.ENVIRONMENT}-user-data`,
  TASKS: `aletheia-${process.env.ENVIRONMENT}-tasks`,
  SESSIONS: `aletheia-${process.env.ENVIRONMENT}-bot-sessions`,
} as const;

export const QueueUrls = {
  TASKS: process.env.TASK_QUEUE_URL!,
} as const;
