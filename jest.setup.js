// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'local';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.AWS_ACCESS_KEY_ID = 'local';
process.env.AWS_SECRET_ACCESS_KEY = 'local';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: jest.fn(),
  })),
}));

// Mock CloudWatch
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => ({
    send: jest.fn(),
  })),
}));

// Clean up resources after each test
afterEach(() => {
  jest.clearAllMocks();
}); 