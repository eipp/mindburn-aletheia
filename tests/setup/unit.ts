import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';

// Mock AWS services
export const dynamoMock = mockClient(DynamoDBClient);
export const snsMock = mockClient(SNSClient);
export const sqsMock = mockClient(SQSClient);

// Reset mocks before each test
beforeEach(() => {
  dynamoMock.reset();
  snsMock.reset();
  sqsMock.reset();
});

// Mock Telegram Bot API
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    launch: jest.fn(),
    stop: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock TON SDK
jest.mock('@ton/ton', () => ({
  TonClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    processTransaction: jest.fn(),
  })),
})); 