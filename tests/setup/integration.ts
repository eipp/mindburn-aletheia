import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';

let localstack: StartedTestContainer;
let dynamoClient: DynamoDBClient;
let snsClient: SNSClient;
let sqsClient: SQSClient;

beforeAll(async () => {
  // Start localstack container
  localstack = await new GenericContainer('localstack/localstack:latest')
    .withExposedPorts(4566)
    .withEnvironment({
      SERVICES: 'dynamodb,sns,sqs',
      DEBUG: '1',
    })
    .start();

  const localstackPort = localstack.getMappedPort(4566);
  const endpoint = `http://localhost:${localstackPort}`;

  // Configure AWS clients to use localstack
  const clientConfig = {
    endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  };

  dynamoClient = new DynamoDBClient(clientConfig);
  snsClient = new SNSClient(clientConfig);
  sqsClient = new SQSClient(clientConfig);

  // Initialize test tables and resources
  await initializeTestResources();
});

afterAll(async () => {
  await localstack.stop();
});

async function initializeTestResources() {
  // Create test DynamoDB tables
  await dynamoClient.send(new CreateTableCommand({
    TableName: 'TestTasks',
    // ... table configuration
  }));

  // Create test SNS topics
  await snsClient.send(new CreateTopicCommand({
    Name: 'TestTopic',
  }));

  // Create test SQS queues
  await sqsClient.send(new CreateQueueCommand({
    QueueName: 'TestQueue',
  }));
}

// Export clients for tests
export { dynamoClient, snsClient, sqsClient }; 