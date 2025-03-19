export type Environment = 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  readonly environment: Environment;
  readonly region: string;
  readonly account: string;
  readonly domainName: string;
  readonly certificateArn: string;
}

export const environments: Record<Environment, Omit<EnvironmentConfig, 'environment'>> = {
  dev: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    domainName: 'dev.aletheia.mindburn.org',
    certificateArn: process.env.DEV_CERTIFICATE_ARN!,
  },
  staging: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    domainName: 'staging.aletheia.mindburn.org',
    certificateArn: process.env.STAGING_CERTIFICATE_ARN!,
  },
  prod: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    domainName: 'aletheia.mindburn.org',
    certificateArn: process.env.PROD_CERTIFICATE_ARN!,
  },
};
