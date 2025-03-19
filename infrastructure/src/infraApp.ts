import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from './stacks/infrastructureStack';
import { DynamoDBReplicationStack } from './stacks/dynamoDBReplicationStack';
import { Environment, environments } from './config/environment';

const app = new cdk.App();

// Get environment from context or default to dev
const envName = (app.node.tryGetContext('env') as Environment) || 'dev';
const envConfig = environments[envName];
const stackPrefix = `AletheiaMindburn${envName.charAt(0).toUpperCase() + envName.slice(1)}`;

// Get regions for multi-region deployment
const primaryRegion = app.node.tryGetContext('primary-region') || envConfig.region;
const backupRegion = app.node.tryGetContext('backup-region') || envConfig.backupRegion || 'us-west-2';

// Deploy primary infrastructure stack
const infrastructureStack = new InfrastructureStack(
  app,
  `${stackPrefix}InfrastructureStack`,
  {
    stage: envName,
    alertEmail: envConfig.alertEmail,
    env: {
      account: envConfig.account,
      region: primaryRegion,
    },
    description: `Aletheia Mindburn ${envName} infrastructure resources`,
    tags: {
      Environment: envName,
      Project: 'AletheiaMindburn',
      ManagedBy: 'CDK',
      Component: 'Infrastructure',
    },
  }
);

// Deploy DynamoDB replication stack if multi-region is enabled
if (envConfig.enableMultiRegion) {
  const replicationStack = new DynamoDBReplicationStack(
    app,
    `${stackPrefix}DynamoDBReplicationStack`,
    {
      stage: envName,
      sourceTables: infrastructureStack.dynamoTables || [],
      sourceRegion: primaryRegion,
      replicationRegion: backupRegion,
      env: {
        account: envConfig.account,
        region: backupRegion,
      },
      description: `Aletheia Mindburn ${envName} DynamoDB replication resources`,
      tags: {
        Environment: envName,
        Project: 'AletheiaMindburn',
        ManagedBy: 'CDK',
        Component: 'DynamoDBReplication',
      },
    }
  );
  
  // Add dependency to ensure the primary stack is deployed first
  replicationStack.addDependency(infrastructureStack);
  
  // Output the replication configuration
  new cdk.CfnOutput(replicationStack, 'ReplicationConfig', {
    value: JSON.stringify({
      sourceRegion: primaryRegion,
      destinationRegion: backupRegion,
      replicatedTables: infrastructureStack.dynamoTables?.map(table => table.tableName) || [],
    }),
    description: 'DynamoDB Replication Configuration',
  });
}

app.synth(); 