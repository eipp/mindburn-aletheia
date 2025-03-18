import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, GlobalSecondaryIndex } from '@aws-sdk/client-dynamodb';

export const TABLES = {
  WORKER_ACTIVITY: 'worker_activity',
  FRAUD_EVENTS: 'fraud_events',
  QUALITY_METRICS: 'quality_metrics',
  GOLDEN_SET: 'golden_set',
  IP_INTELLIGENCE: 'ip_intelligence'
};

export const INDEXES = {
  WORKER_ACTIVITY: {
    BY_WORKER: 'by_worker_index',
    BY_IP: 'by_ip_index',
    BY_DEVICE: 'by_device_index'
  },
  FRAUD_EVENTS: {
    BY_SEVERITY: 'by_severity_index',
    BY_TYPE: 'by_type_index'
  },
  QUALITY_METRICS: {
    BY_SCORE: 'by_score_index',
    BY_TASK_TYPE: 'by_task_type_index'
  }
};

export class SchemaManager {
  private readonly client: DynamoDBClient;

  constructor(client: DynamoDBClient) {
    this.client = client;
  }

  async createTables(): Promise<void> {
    await Promise.all([
      this.createWorkerActivityTable(),
      this.createFraudEventsTable(),
      this.createQualityMetricsTable(),
      this.createGoldenSetTable(),
      this.createIpIntelligenceTable()
    ]);
  }

  private async createWorkerActivityTable(): Promise<void> {
    const indexes: GlobalSecondaryIndex[] = [
      {
        IndexName: INDEXES.WORKER_ACTIVITY.BY_WORKER,
        KeySchema: [
          { AttributeName: 'workerId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: INDEXES.WORKER_ACTIVITY.BY_IP,
        KeySchema: [
          { AttributeName: 'ipAddress', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: INDEXES.WORKER_ACTIVITY.BY_DEVICE,
        KeySchema: [
          { AttributeName: 'deviceFingerprint', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ];

    const command = new CreateTableCommand({
      TableName: TABLES.WORKER_ACTIVITY,
      KeySchema: [
        { AttributeName: 'taskId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'taskId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
        { AttributeName: 'workerId', AttributeType: 'S' },
        { AttributeName: 'ipAddress', AttributeType: 'S' },
        { AttributeName: 'deviceFingerprint', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: indexes,
      BillingMode: 'PAY_PER_REQUEST'
    });

    await this.client.send(command);
  }

  private async createFraudEventsTable(): Promise<void> {
    const indexes: GlobalSecondaryIndex[] = [
      {
        IndexName: INDEXES.FRAUD_EVENTS.BY_SEVERITY,
        KeySchema: [
          { AttributeName: 'severity', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: INDEXES.FRAUD_EVENTS.BY_TYPE,
        KeySchema: [
          { AttributeName: 'fraudType', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ];

    const command = new CreateTableCommand({
      TableName: TABLES.FRAUD_EVENTS,
      KeySchema: [
        { AttributeName: 'eventId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'eventId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
        { AttributeName: 'severity', AttributeType: 'S' },
        { AttributeName: 'fraudType', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: indexes,
      BillingMode: 'PAY_PER_REQUEST'
    });

    await this.client.send(command);
  }

  private async createQualityMetricsTable(): Promise<void> {
    const indexes: GlobalSecondaryIndex[] = [
      {
        IndexName: INDEXES.QUALITY_METRICS.BY_SCORE,
        KeySchema: [
          { AttributeName: 'qualityScore', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: INDEXES.QUALITY_METRICS.BY_TASK_TYPE,
        KeySchema: [
          { AttributeName: 'taskType', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ];

    const command = new CreateTableCommand({
      TableName: TABLES.QUALITY_METRICS,
      KeySchema: [
        { AttributeName: 'workerId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'workerId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
        { AttributeName: 'qualityScore', AttributeType: 'N' },
        { AttributeName: 'taskType', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: indexes,
      BillingMode: 'PAY_PER_REQUEST'
    });

    await this.client.send(command);
  }

  private async createGoldenSetTable(): Promise<void> {
    const command = new CreateTableCommand({
      TableName: TABLES.GOLDEN_SET,
      KeySchema: [
        { AttributeName: 'taskId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'taskId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    await this.client.send(command);
  }

  private async createIpIntelligenceTable(): Promise<void> {
    const command = new CreateTableCommand({
      TableName: TABLES.IP_INTELLIGENCE,
      KeySchema: [
        { AttributeName: 'ipAddress', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'ipAddress', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'ttl'
      }
    });

    await this.client.send(command);
  }
} 