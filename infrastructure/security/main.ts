import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecureVpcStack } from './vpc/vpc-config';
import { WafStack } from './waf/waf-rules';
import { SecurityDashboardStack } from './monitoring/security-dashboard';
import { MfaAuthStack } from './auth/mfa-config';
import { LambdaHardeningStack } from './runtime/lambda-hardening';

interface SecurityStackProps extends cdk.StackProps {
  environment: string;
  accountId: string;
}

export class MainSecurityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // Deploy VPC with security configuration
    const vpcStack = new SecureVpcStack(this, 'SecureVPC', {
      env: {
        account: props.accountId,
        region: props.env?.region,
      },
    });

    // Deploy WAF rules
    const wafStack = new WafStack(this, 'WAFRules', {
      env: {
        account: props.accountId,
        region: props.env?.region,
      },
    });

    // Deploy security monitoring
    const monitoringStack = new SecurityDashboardStack(this, 'SecurityMonitoring', {
      env: {
        account: props.accountId,
        region: props.env?.region,
      },
    });

    // Deploy MFA configuration
    const mfaStack = new MfaAuthStack(this, 'MFAAuth', {
      env: {
        account: props.accountId,
        region: props.env?.region,
      },
    });

    // Deploy Lambda hardening
    const lambdaHardeningStack = new LambdaHardeningStack(this, 'LambdaHardening', {
      env: {
        account: props.accountId,
        region: props.env?.region,
      },
    });

    // Tag all resources
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Service', 'mindburn-aletheia');
    cdk.Tags.of(this).add('SecurityLevel', 'high');

    // Output security configuration
    new cdk.CfnOutput(this, 'SecurityConfig', {
      value: JSON.stringify(
        {
          vpcId: vpcStack.vpcId,
          wafAclId: wafStack.webAclId,
          userPoolId: mfaStack.userPoolId,
          securityDashboard: monitoringStack.dashboardName,
        },
        null,
        2
      ),
      description: 'Security Configuration Summary',
    });
  }
}
