import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MfaAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool with MFA
    const userPool = new cognito.UserPool(this, 'AdminUserPool', {
      userPoolName: 'mindburn-admin-pool',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        otp: true,
        sms: false
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Create admin group
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Administrators',
      description: 'Administrator group with elevated privileges',
      precedence: 0,
    });

    // Create IAM role for admin group
    const adminRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      description: 'Role for Cognito Admin Group',
    });

    // Add admin permissions
    adminRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:*',
        'lambda:InvokeFunction',
        'kms:Decrypt',
        'secretsmanager:GetSecretValue'
      ],
      resources: ['*'],
      conditions: {
        'StringEquals': {
          'aws:RequestTag/Environment': '${environment}',
          'aws:RequestTag/Service': 'mindburn-aletheia'
        },
        'Bool': {
          'aws:MultiFactorAuthPresent': 'true'
        }
      }
    }));

    // Create app client
    const client = userPool.addClient('AdminAppClient', {
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        custom: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['https://admin.mindburn-aletheia.com/callback'],
      },
    });

    // Output values
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: client.userPoolClientId,
    });
  }
} 