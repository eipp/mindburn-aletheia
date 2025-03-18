import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';

// Mock AWS services
export const dynamoDBMock = mockClient(DynamoDBClient);
export const snsMock = mockClient(SNSClient);
export const sqsMock = mockClient(SQSClient);

// Reset all mocks before each test
beforeEach(() => {
  dynamoDBMock.reset();
  snsMock.reset();
  sqsMock.reset();
});

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE = 'test-table';
process.env.TON_ENDPOINT = 'https://test.ton.org';
process.env.KYC_API_KEY = 'test-api-key';
process.env.MIN_WALLET_BALANCE = '0.1';

// Mock console.error to catch unhandled errors
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    args[0] instanceof Error &&
    args[0].message.includes('Unhandled error in test')
  ) {
    throw args[0];
  }
  originalConsoleError.apply(console, args);
}; 