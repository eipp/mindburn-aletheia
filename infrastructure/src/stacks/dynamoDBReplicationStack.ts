import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface DynamoDBReplicationStackProps extends cdk.StackProps {
  stage: string;
  sourceTables: dynamodb.ITable[];
  sourceRegion: string;
  replicationRegion: string;
}

export class DynamoDBReplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DynamoDBReplicationStackProps) {
    super(scope, id, props);

    if (props.sourceTables.length === 0) {
      // No tables to replicate
      new cdk.CfnOutput(this, 'NoTablesReplicated', {
        value: 'No DynamoDB tables to replicate',
        description: 'No tables were provided for replication',
      });
      return;
    }

    // Create IAM role for replication
    const replicationRole = new iam.Role(this, 'DynamoDBReplicationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add permissions to read from source tables and write to replica tables
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:DescribeTable',
          'dynamodb:Scan',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchWriteItem',
        ],
        resources: [
          ...props.sourceTables.map(table => table.tableArn),
          ...props.sourceTables.map(
            table => `arn:aws:dynamodb:${props.replicationRegion}:${this.account}:table/${table.tableName}`
          ),
        ],
      })
    );

    // Add permissions for global table replication
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:CreateGlobalTable',
          'dynamodb:DescribeGlobalTable',
          'dynamodb:UpdateGlobalTable',
          'dynamodb:DescribeGlobalTableSettings',
          'dynamodb:UpdateGlobalTableSettings',
        ],
        resources: [
          ...props.sourceTables.map(
            table => `arn:aws:dynamodb::${this.account}:global-table/${table.tableName}`
          ),
        ],
      })
    );

    // Add permission for DynamoDB streams
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:DescribeStream',
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:ListStreams',
        ],
        resources: props.sourceTables.map(table => `${table.tableArn}/stream/*`),
      })
    );

    // Create Lambda function for setting up global tables
    const setupGlobalTablesFunction = new lambda.Function(this, 'SetupGlobalTablesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const AWS = require('aws-sdk');
const sourceRegion = '${props.sourceRegion}';
const replicationRegion = '${props.replicationRegion}';
const tableNames = ${JSON.stringify(props.sourceTables.map(table => table.tableName))};

exports.handler = async function(event) {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const dynamodb = new AWS.DynamoDB({ region: sourceRegion });
  
  for (const tableName of tableNames) {
    console.log(\`Setting up global table for \${tableName}\`);
    
    try {
      // Check if table already exists as global table
      try {
        const globalTableInfo = await dynamodb.describeGlobalTable({ GlobalTableName: tableName }).promise();
        console.log(\`Global table already exists for \${tableName}:\`, JSON.stringify(globalTableInfo, null, 2));
        
        // Check if replication region is already included
        const replicaExists = globalTableInfo.GlobalTableDescription.ReplicationGroup.some(
          replica => replica.RegionName === replicationRegion
        );
        
        if (replicaExists) {
          console.log(\`Replica already exists in \${replicationRegion} for table \${tableName}\`);
          continue;
        }
      } catch (error) {
        if (error.code !== 'GlobalTableNotFoundException') {
          throw error;
        }
        console.log(\`No global table found for \${tableName}, creating new global table\`);
      }
      
      // Make sure streams are enabled on the source table
      const tableInfo = await dynamodb.describeTable({ TableName: tableName }).promise();
      if (!tableInfo.Table.StreamSpecification || tableInfo.Table.StreamSpecification.StreamEnabled !== true) {
        console.log(\`Enabling streams on table \${tableName}\`);
        await dynamodb.updateTable({
          TableName: tableName,
          StreamSpecification: {
            StreamEnabled: true,
            StreamViewType: 'NEW_AND_OLD_IMAGES'
          }
        }).promise();
        
        // Wait for the stream to be active
        console.log(\`Waiting for stream to be active on table \${tableName}\`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Create or update the global table
      try {
        await dynamodb.createGlobalTable({
          GlobalTableName: tableName,
          ReplicationGroup: [
            { RegionName: sourceRegion },
            { RegionName: replicationRegion }
          ]
        }).promise();
        console.log(\`Created global table for \${tableName}\`);
      } catch (error) {
        if (error.code === 'GlobalTableAlreadyExistsException') {
          // Table exists but doesn't have our replica region, add it
          await dynamodb.updateGlobalTable({
            GlobalTableName: tableName,
            ReplicaUpdates: [
              {
                Create: {
                  RegionName: replicationRegion
                }
              }
            ]
          }).promise();
          console.log(\`Added replica region \${replicationRegion} to global table \${tableName}\`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(\`Error setting up global table for \${tableName}:\`, error);
      throw error;
    }
  }
  
  return { 
    statusCode: 200,
    body: JSON.stringify({ 
      message: 'Global tables setup complete', 
      tables: tableNames,
      sourceRegion,
      replicationRegion
    })
  };
};
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      role: replicationRole,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        SOURCE_REGION: props.sourceRegion,
        REPLICATION_REGION: props.replicationRegion,
        STAGE: props.stage,
      },
    });

    // Create CloudWatch event rule to trigger the Lambda on a schedule
    const rule = new events.Rule(this, 'GlobalTableSetupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      description: 'Daily check of global table configuration',
    });
    
    rule.addTarget(new targets.LambdaFunction(setupGlobalTablesFunction));

    // Also run the function once on stack creation/update
    const customResource = new cdk.CustomResource(this, 'InitialGlobalTableSetup', {
      serviceToken: setupGlobalTablesFunction.functionArn,
      properties: {
        timestamp: Date.now(), // Force update on each deployment
      },
    });

    // Create CloudWatch dashboard for replication monitoring
    const dashboard = new cloudwatch.Dashboard(this, 'DynamoDBReplicationDashboard', {
      dashboardName: `DynamoDBReplication-${props.stage}`,
    });

    // Add widgets for each table
    const widgets: cloudwatch.IWidget[] = [];
    
    // Add replication metrics for each table
    props.sourceTables.forEach((table, index) => {
      widgets.push(
        new cloudwatch.TextWidget({
          markdown: `# ${table.tableName} Replication Metrics`,
          width: 24,
          height: 1,
        })
      );
      
      widgets.push(
        new cloudwatch.GraphWidget({
          title: `${table.tableName} - Replication Latency`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'ReplicationLatency',
              dimensions: {
                TableName: table.tableName,
                ReceivingRegion: props.replicationRegion,
              },
              region: props.sourceRegion,
              statistic: 'Average',
              period: cdk.Duration.minutes(1),
            }),
          ],
          width: 12,
          height: 6,
        })
      );
      
      widgets.push(
        new cloudwatch.GraphWidget({
          title: `${table.tableName} - Replicated Items`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'ReplicationItemCount',
              dimensions: {
                TableName: table.tableName,
                ReceivingRegion: props.replicationRegion,
              },
              region: props.sourceRegion,
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          ],
          width: 12,
          height: 6,
        })
      );
    });
    
    // Add widgets to the dashboard
    dashboard.addWidgets(...widgets);

    // Create CloudWatch alarms for replication latency
    props.sourceTables.forEach(table => {
      const replicationLatencyAlarm = new cloudwatch.Alarm(this, `${table.tableName}-ReplicationLatencyAlarm`, {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ReplicationLatency',
          dimensions: {
            TableName: table.tableName,
            ReceivingRegion: props.replicationRegion,
          },
          region: props.sourceRegion,
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 60000, // 60 seconds
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `High replication latency for table ${table.tableName} to region ${props.replicationRegion}`,
      });
    });

    // Add outputs
    new cdk.CfnOutput(this, 'ReplicatedTables', {
      value: props.sourceTables.map(table => table.tableName).join(', '),
      description: 'DynamoDB tables being replicated',
    });
    
    new cdk.CfnOutput(this, 'SourceRegion', {
      value: props.sourceRegion,
      description: 'Source region for DynamoDB replication',
    });
    
    new cdk.CfnOutput(this, 'ReplicationRegion', {
      value: props.replicationRegion,
      description: 'Destination region for DynamoDB replication',
    });
    
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://${props.replicationRegion}.console.aws.amazon.com/cloudwatch/home?region=${props.replicationRegion}#dashboards:name=${dashboard.dashboardName}`,
      description: 'URL for DynamoDB replication dashboard',
    });
  }
} 