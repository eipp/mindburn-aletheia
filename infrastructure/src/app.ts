import * as cdk from 'aws-cdk-lib';
import { MainStack } from './stacks/main-stack';
import { Environment, environments } from './config/environment';

const app = new cdk.App();

// Get environment from context or default to dev
const envName = (app.node.tryGetContext('env') as Environment) || 'dev';
const envConfig = environments[envName];

new MainStack(app, `AletheiaMindburn${envName.charAt(0).toUpperCase() + envName.slice(1)}Stack`, {
  environment: envName,
  ...envConfig,
}, {
  env: {
    account: envConfig.account,
    region: envConfig.region,
  },
  description: `Aletheia Mindburn ${envName} environment stack`,
  tags: {
    Environment: envName,
    Project: 'AletheiaMindburn',
    ManagedBy: 'CDK',
  },
});

app.synth(); 