import { createHash } from 'crypto';
import { Migration } from '../MigrationManager';

export class AddWorkerSkillsGSI extends Migration {
  private readonly tableName = 'Workers';
  private readonly gsiName = 'SkillLevelIndex';

  async up(): Promise<void> {
    // Update table with new GSI
    await this.context.dynamodb.updateTable({
      TableName: this.tableName,
      AttributeDefinitions: [
        { AttributeName: 'skillId', AttributeType: 'S' },
        { AttributeName: 'expertiseLevel', AttributeType: 'N' }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: this.gsiName,
            KeySchema: [
              { AttributeName: 'skillId', KeyType: 'HASH' },
              { AttributeName: 'expertiseLevel', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          }
        }
      ]
    }).promise();

    // Wait for GSI to become active
    await this.waitForGSIActive();

    // Update existing items with new attributes
    await this.updateExistingItems();
  }

  async down(): Promise<void> {
    await this.context.dynamodb.updateTable({
      TableName: this.tableName,
      GlobalSecondaryIndexUpdates: [
        {
          Delete: {
            IndexName: this.gsiName
          }
        }
      ]
    }).promise();
  }

  async validate(): Promise<boolean> {
    try {
      // Check if GSI exists and is active
      const table = await this.context.dynamodb.describeTable({
        TableName: this.tableName
      }).promise();

      const gsi = table.Table.GlobalSecondaryIndexes?.find(
        index => index.IndexName === this.gsiName
      );

      if (!gsi || gsi.IndexStatus !== 'ACTIVE') {
        return false;
      }

      // Verify sample queries work
      const testQuery = await this.context.dynamodb.query({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'skillId = :skillId',
        ExpressionAttributeValues: {
          ':skillId': 'TEST_SKILL'
        }
      }).promise();

      return true;
    } catch (error) {
      this.context.logger.error('Validation failed:', error);
      return false;
    }
  }

  generateChecksum(): string {
    const content = `
      ${this.tableName}
      ${this.gsiName}
      skillId:S
      expertiseLevel:N
      ALL
    `;
    return createHash('sha256').update(content).digest('hex');
  }

  private async waitForGSIActive(): Promise<void> {
    let isActive = false;
    while (!isActive) {
      const table = await this.context.dynamodb.describeTable({
        TableName: this.tableName
      }).promise();

      const gsi = table.Table.GlobalSecondaryIndexes?.find(
        index => index.IndexName === this.gsiName
      );

      if (gsi?.IndexStatus === 'ACTIVE') {
        isActive = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async updateExistingItems(): Promise<void> {
    let lastEvaluatedKey;
    do {
      const scanResult = await this.context.dynamodb.scan({
        TableName: this.tableName,
        ExclusiveStartKey: lastEvaluatedKey
      }).promise();

      const updates = scanResult.Items.map(item => ({
        PutRequest: {
          Item: {
            ...item,
            skillId: item.primarySkill || 'UNKNOWN',
            expertiseLevel: item.yearsOfExperience || 0
          }
        }
      }));

      if (updates.length > 0) {
        await this.context.dynamodb.batchWrite({
          RequestItems: {
            [this.tableName]: updates
          }
        }).promise();
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }
} 