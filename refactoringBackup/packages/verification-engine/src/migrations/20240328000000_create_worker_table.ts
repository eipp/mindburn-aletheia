import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('WorkerTableMigration');

export async function up(dynamodb: DynamoDB, tableName: string) {
  try {
    logger.info('Creating worker table', { tableName });

    await dynamodb.createTable({
      TableName: tableName,
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'walletAddress', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' },
        { AttributeName: 'updatedAt', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'walletAddress-index',
          KeySchema: [
            { AttributeName: 'walletAddress', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        },
        {
          IndexName: 'status-updatedAt-index',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'updatedAt', KeyType: 'RANGE' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      },
      SSESpecification: {
        Enabled: true,
        SSEType: 'KMS'
      },
      Tags: [
        {
          Key: 'Environment',
          Value: process.env.STAGE || 'development'
        },
        {
          Key: 'Service',
          Value: 'verification-engine'
        }
      ]
    });

    logger.info('Worker table created successfully', { tableName });
  } catch (error) {
    logger.error('Failed to create worker table', { error, tableName });
    throw error;
  }
}

export async function down(dynamodb: DynamoDB, tableName: string) {
  try {
    logger.info('Deleting worker table', { tableName });

    await dynamodb.deleteTable({
      TableName: tableName
    });

    logger.info('Worker table deleted successfully', { tableName });
  } catch (error) {
    logger.error('Failed to delete worker table', { error, tableName });
    throw error;
  }
} 