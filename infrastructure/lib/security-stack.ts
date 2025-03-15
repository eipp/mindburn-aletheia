import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface SecurityStackProps extends cdk.StackProps {
  environment: string;
  adminEmail: string;
}

export class SecurityStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;
  public readonly userPool: cognito.UserPool;
  public readonly apiWaf: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // KMS Key for field-level encryption
    this.encryptionKey = new kms.Key(this, 'FieldEncryptionKey', {
      enableKeyRotation: true,
      description: `Aletheia ${props.environment} field encryption key`,
      alias: `aletheia/${props.environment}/field-encryption`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Secrets Manager for credentials
    const botToken = new secretsmanager.Secret(this, 'BotToken', {
      secretName: `/aletheia/${props.environment}/bot-token`,
      description: 'Telegram Bot Token',
      encryptionKey: this.encryptionKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ version: '1' }),
        generateStringKey: 'token',
      },
    });

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aletheia-${props.environment}-users`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Admin user group
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admins',
      description: 'Administrator group',
    });

    // WAF for API Gateway
    this.apiWaf = new wafv2.CfnWebACL(this, 'ApiWaf', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `aletheia-${props.environment}-waf`,
        sampledRequestsEnabled: true,
      },
      name: `aletheia-${props.environment}-waf`,
      rules: [
        {
          name: 'RateLimit',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'SQLInjection',
          priority: 2,
          statement: {
            sqliMatchStatement: {
              fieldToMatch: {
                body: {},
              },
              textTransformations: [{ priority: 1, type: 'NONE' }],
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLInjection',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'XSS',
          priority: 3,
          statement: {
            xssMatchStatement: {
              fieldToMatch: {
                body: {},
              },
              textTransformations: [{ priority: 1, type: 'NONE' }],
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'XSS',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // CloudTrail for audit logging
    const trailBucket = new s3.Bucket(this, 'AuditLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    const trail = new cloudtrail.Trail(this, 'AuditTrail', {
      bucket: trailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      trailName: `aletheia-${props.environment}-audit`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'WafArn', {
      value: this.apiWaf.attrArn,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
    });
  }
} 