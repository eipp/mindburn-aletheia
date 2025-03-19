import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
  enableBackups: boolean;
}

export class DatabaseStack extends cdk.Stack {
  public readonly tables: Record<string, dynamodb.Table> = {};

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Create DynamoDB tables from schema definitions
    this.createTablesFromSchemas(props);

    // Create migration resources if needed
    if (props.enableBackups) {
      this.setupMigrationResources(props);
    }
  }

  private createTablesFromSchemas(props: DatabaseStackProps): void {
    const schemaDir = path.join(__dirname, '../../dynamodb/schema');
    const schemaFiles = fs.readdirSync(schemaDir).filter(file => file.endsWith('.json'));

    for (const schemaFile of schemaFiles) {
      const schemaPath = path.join(schemaDir, schemaFile);
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      
      // Create table with the base configuration
      const tableName = `aletheia-${props.stage}-${schema.TableName.toLowerCase()}`;
      
      // Define attribute definitions from schema
      const attributeDefinitions: dynamodb.CfnTable.AttributeDefinitionProperty[] = 
        schema.AttributeDefinitions.map(attr => ({
          attributeName: attr.AttributeName,
          attributeType: attr.AttributeType
        }));
      
      // Define key schema from schema
      const keySchema: dynamodb.CfnTable.KeySchemaProperty[] = 
        schema.KeySchema.map(key => ({
          attributeName: key.AttributeName,
          keyType: key.KeyType
        }));
      
      // Create the table resource
      const table = new dynamodb.Table(this, schema.TableName, {
        tableName,
        partitionKey: { 
          name: schema.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName || 'PK', 
          type: this.getAttributeType(schema.AttributeDefinitions, schema.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName || 'PK')
        },
        sortKey: schema.KeySchema.find(k => k.KeyType === 'RANGE') ? {
          name: schema.KeySchema.find(k => k.KeyType === 'RANGE')?.AttributeName || 'SK',
          type: this.getAttributeType(schema.AttributeDefinitions, schema.KeySchema.find(k => k.KeyType === 'RANGE')?.AttributeName || 'SK')
        } : undefined,
        billingMode: schema.BillingMode === 'PAY_PER_REQUEST' 
          ? dynamodb.BillingMode.PAY_PER_REQUEST 
          : dynamodb.BillingMode.PROVISIONED,
        pointInTimeRecovery: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
      
      // Add GSIs if defined in schema
      if (schema.GlobalSecondaryIndexes) {
        for (const gsi of schema.GlobalSecondaryIndexes) {
          table.addGlobalSecondaryIndex({
            indexName: gsi.IndexName,
            partitionKey: {
              name: gsi.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName || '',
              type: this.getAttributeType(schema.AttributeDefinitions, gsi.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName || '')
            },
            sortKey: gsi.KeySchema.find(k => k.KeyType === 'RANGE') ? {
              name: gsi.KeySchema.find(k => k.KeyType === 'RANGE')?.AttributeName || '',
              type: this.getAttributeType(schema.AttributeDefinitions, gsi.KeySchema.find(k => k.KeyType === 'RANGE')?.AttributeName || '')
            } : undefined,
            projectionType: this.getProjectionType(gsi.Projection.ProjectionType)
          });
        }
      }
      
      // Add TTL if specified
      if (schema.TimeToLiveSpecification) {
        table.addTimeToLiveAttribute(schema.TimeToLiveSpecification.AttributeName);
      }
      
      // Store table reference for exports
      this.tables[schema.TableName] = table;
      
      // Add table name to outputs
      new cdk.CfnOutput(this, `${schema.TableName}TableName`, {
        value: table.tableName,
        description: `Name of the ${schema.TableName} table`,
        exportName: `${props.stage}-${schema.TableName}TableName`
      });
    }
  }

  private setupMigrationResources(props: DatabaseStackProps): void {
    // Create migrations table
    const migrationsTable = new dynamodb.Table(this, 'MigrationsTable', {
      tableName: `aletheia-${props.stage}-migrations`,
      partitionKey: { name: 'version', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for tracking migration status
    migrationsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'appliedAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Create Lambda function for running migrations
    const migrationLambdaRole = new iam.Role(this, 'MigrationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions to all tables
    for (const tableName in this.tables) {
      this.tables[tableName].grantReadWriteData(migrationLambdaRole);
    }
    
    // Grant permissions to migrations table
    migrationsTable.grantReadWriteData(migrationLambdaRole);

    // Add specific permissions for migrations
    migrationLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:CreateTable',
        'dynamodb:UpdateTable',
        'dynamodb:DeleteTable',
        'dynamodb:CreateBackup',
        'dynamodb:DescribeBackup',
        'dynamodb:ListBackups',
        'dynamodb:RestoreTableFromBackup',
      ],
      resources: ['*'],
    }));

    // Lambda function for migrations
    const migrationLambda = new lambda.Function(this, 'MigrationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../packages/infrastructure-tools/dist/migration-handler'),
      role: migrationLambdaRole,
      environment: {
        STAGE: props.stage,
        MIGRATIONS_TABLE: migrationsTable.tableName,
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
    });

    // Output migrations table name
    new cdk.CfnOutput(this, 'MigrationsTableName', {
      value: migrationsTable.tableName,
      description: 'Database migrations table name',
      exportName: `${props.stage}-MigrationsTableName`
    });
  }

  private getAttributeType(
    attributeDefinitions: { AttributeName: string; AttributeType: string }[],
    attributeName: string
  ): dynamodb.AttributeType {
    const attrDef = attributeDefinitions.find(ad => ad.AttributeName === attributeName);
    
    if (!attrDef) {
      throw new Error(`Attribute definition not found for ${attributeName}`);
    }
    
    switch (attrDef.AttributeType) {
      case 'S':
        return dynamodb.AttributeType.STRING;
      case 'N':
        return dynamodb.AttributeType.NUMBER;
      case 'B':
        return dynamodb.AttributeType.BINARY;
      default:
        throw new Error(`Unknown attribute type: ${attrDef.AttributeType}`);
    }
  }

  private getProjectionType(projectionType: string): dynamodb.ProjectionType {
    switch (projectionType) {
      case 'ALL':
        return dynamodb.ProjectionType.ALL;
      case 'KEYS_ONLY':
        return dynamodb.ProjectionType.KEYS_ONLY;
      case 'INCLUDE':
        return dynamodb.ProjectionType.INCLUDE;
      default:
        return dynamodb.ProjectionType.ALL;
    }
  }
} 