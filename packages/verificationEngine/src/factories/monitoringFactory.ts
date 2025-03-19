import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { SNS } from '@aws-sdk/client-sns';
import { MonitoringManager } from '../monitoring/monitoringManager';

export interface MonitoringConfig {
  environment: string;
  alarmTopicArn: string;
  namespace: string;
  region: string;
}

export function createMonitoringManager(config: MonitoringConfig): MonitoringManager {
  const cloudwatch = new CloudWatch({
    region: config.region,
    apiVersion: '2010-08-01',
    maxAttempts: 3,
  });

  const sns = new SNS({
    region: config.region,
    apiVersion: '2010-03-31',
    maxAttempts: 3,
  });

  return new MonitoringManager(cloudwatch, sns, {
    environment: config.environment,
    alarmTopicArn: config.alarmTopicArn,
    namespace: config.namespace,
  });
}

// Example usage:
/*
const monitoring = createMonitoringManager({
  environment: 'production',
  alarmTopicArn: 'arn:aws:sns:region:account:topic',
  namespace: 'VerificationEngine',
  region: 'us-east-1'
});

await monitoring.setupDefaultAlarms();
*/
