import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class WebSocketConnectionsStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'WebSocketConnections', {
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development, change for production
    });

    // Add GSI for worker_id to efficiently find worker connections
    this.table.addGlobalSecondaryIndex({
      indexName: 'WorkerIdIndex',
      partitionKey: {
        name: 'worker_id',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for developer_id to efficiently find developer connections
    this.table.addGlobalSecondaryIndex({
      indexName: 'DeveloperIdIndex',
      partitionKey: {
        name: 'developer_id',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'WebSocket Connections Table Name',
    });
  }
} 