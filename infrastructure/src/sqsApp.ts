import * as cdk from 'aws-cdk-lib';
import { SQSStack } from './stacks/sqsStack';
import { Environment, environments } from './config/environment';

const app = new cdk.App();

// Get environment from context or default to dev
const envName = (app.node.tryGetContext('env') as Environment) || 'dev';
const envConfig = environments[envName];

// Deploy SQS resources
const sqsStack = new SQSStack(
  app,
  `AletheiaMindburn${envName.charAt(0).toUpperCase() + envName.slice(1)}SQSStack`,
  {
    stage: envName,
    alertEmail: envConfig.alertEmail,
    env: {
      account: envConfig.account,
      region: envConfig.region,
    },
    description: `Aletheia Mindburn ${envName} SQS resources`,
    tags: {
      Environment: envName,
      Project: 'AletheiaMindburn',
      ManagedBy: 'CDK',
      Component: 'SQS',
    },
  }
);

app.synth(); 