import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export class WafStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create WAF ACL
    const webAcl = new wafv2.CfnWebACL(this, 'MindBurnWAF', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'MindBurnWAFMetrics',
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rate limiting rule
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
            metricName: 'RateLimitMetric',
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Rules - Common
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSetMetric',
            sampledRequestsEnabled: true,
          },
        },
        // SQL Injection Prevention
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSetMetric',
            sampledRequestsEnabled: true,
          },
        },
        // Bad Input Prevention
        {
          name: 'BadInputsRule',
          priority: 4,
          statement: {
            orStatement: {
              statements: [
                {
                  sizeConstraintStatement: {
                    comparisonOperator: 'GT',
                    size: 8192,
                    fieldToMatch: { body: {} },
                    textTransformations: [{ priority: 1, type: 'NONE' }],
                  },
                },
                {
                  xssMatchStatement: {
                    fieldToMatch: { body: {} },
                    textTransformations: [{ priority: 1, type: 'HTML_ENTITY_DECODE' }],
                  },
                },
              ],
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'BadInputsRuleMetric',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Output WAF ACL ID
    new cdk.CfnOutput(this, 'WebAclId', {
      value: webAcl.attrId,
      description: 'WAF Web ACL ID',
    });
  }
}
