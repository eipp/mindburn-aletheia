import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDB, S3, KMS, CognitoIdentityProvider } from 'aws-sdk';

// Mock AWS services
export const dynamoDBMock = mockClient(DynamoDB);
export const s3Mock = mockClient(S3);
export const kmsMock = mockClient(KMS);
export const cognitoMock = mockClient(CognitoIdentityProvider);

// Reset all mocks before each test
beforeEach(() => {
  dynamoDBMock.reset();
  s3Mock.reset();
  kmsMock.reset();
  cognitoMock.reset();
});

// Mock environment variables
process.env = {
  ...process.env,
  AWS_REGION: 'us-east-1',
  NODE_ENV: 'test',
}; 