import {
  AttributeType,
  BillingMode,
  ProjectionType,
  StreamViewType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export const createTasksTable = (scope: any, id: string) => {
  return new Table(scope, id, {
    tableName: 'Tasks',
    partitionKey: { name: 'taskId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    timeToLiveAttribute: 'expiresAt',

    // GSIs for efficient querying
    globalSecondaryIndexes: [
      {
        indexName: 'StatusIndex',
        partitionKey: { name: 'status', type: AttributeType.STRING },
        sortKey: { name: 'createdAt', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      },
      {
        indexName: 'TypeIndex',
        partitionKey: { name: 'taskType', type: AttributeType.STRING },
        sortKey: { name: 'status', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      },
    ],
  });
};

export const createWorkersTable = (scope: any, id: string) => {
  return new Table(scope, id, {
    tableName: 'Workers',
    partitionKey: { name: 'workerId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,

    globalSecondaryIndexes: [
      {
        indexName: 'StatusIndex',
        partitionKey: { name: 'status', type: AttributeType.STRING },
        sortKey: { name: 'lastActive', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      },
      {
        indexName: 'TaskTypeIndex',
        partitionKey: { name: 'taskType', type: AttributeType.STRING },
        sortKey: { name: 'rating', type: AttributeType.NUMBER },
        projectionType: ProjectionType.ALL,
      },
    ],
  });
};

export const createResultsTable = (scope: any, id: string) => {
  return new Table(scope, id, {
    tableName: 'Results',
    partitionKey: { name: 'taskId', type: AttributeType.STRING },
    sortKey: { name: 'workerId', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,

    globalSecondaryIndexes: [
      {
        indexName: 'WorkerIndex',
        partitionKey: { name: 'workerId', type: AttributeType.STRING },
        sortKey: { name: 'submittedAt', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      },
    ],
  });
};

export const createMetricsTable = (scope: any, id: string) => {
  return new Table(scope, id, {
    tableName: 'WorkerMetrics',
    partitionKey: { name: 'workerId', type: AttributeType.STRING },
    sortKey: { name: 'metricType', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,

    globalSecondaryIndexes: [
      {
        indexName: 'MetricTypeIndex',
        partitionKey: { name: 'metricType', type: AttributeType.STRING },
        sortKey: { name: 'value', type: AttributeType.NUMBER },
        projectionType: ProjectionType.ALL,
      },
    ],
  });
};

export function createVerificationCacheTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'VerificationCache', {
    partitionKey: { name: 'hash', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  }).addGlobalSecondaryIndex({
    indexName: 'SimilarityIndex',
    partitionKey: { name: 'similarityKey', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });
}

export function createGoldenSetTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'GoldenSet', {
    partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  }).addGlobalSecondaryIndex({
    indexName: 'TaskTypeIndex',
    partitionKey: { name: 'taskType', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });
}

export function createWorkerActivitiesTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'WorkerActivities', {
    partitionKey: { name: 'workerId', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    timeToLiveAttribute: 'ttl',
  }).addGlobalSecondaryIndex({
    indexName: 'TaskTypeIndex',
    partitionKey: { name: 'taskType', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    projectionType: dynamodb.ProjectionType.ALL,
  });
}

export function createWorkerMetricsTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'WorkerMetrics', {
    partitionKey: { name: 'workerId', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  })
    .addGlobalSecondaryIndex({
      indexName: 'ExpertiseIndex',
      partitionKey: { name: 'expertiseLevel', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    .addGlobalSecondaryIndex({
      indexName: 'AccuracyIndex',
      partitionKey: { name: 'accuracyScore', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
}

export function createConsolidatedResultsTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'ConsolidatedResults', {
    partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  })
    .addGlobalSecondaryIndex({
      indexName: 'StrategyIndex',
      partitionKey: { name: 'strategy', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    .addGlobalSecondaryIndex({
      indexName: 'DecisionIndex',
      partitionKey: { name: 'finalDecision', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'confidence', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
}

export function createInsightsTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'Insights', {
    partitionKey: {
      name: 'timestamp',
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    timeToLiveAttribute: 'ttl',
    globalSecondaryIndexes: [
      {
        indexName: 'TypeIndex',
        partitionKey: {
          name: 'insightType',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.STRING,
        },
        projectionType: dynamodb.ProjectionType.ALL,
      },
    ],
  });
}
