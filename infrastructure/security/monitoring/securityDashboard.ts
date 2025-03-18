import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class SecurityDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'SecurityDashboard', {
      dashboardName: 'MindBurn-Security-Dashboard'
    });

    // WAF Metrics
    const wafWidget = new cloudwatch.GraphWidget({
      title: 'WAF Blocked Requests',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/WAFV2',
          metricName: 'BlockedRequests',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          dimensionsMap: {
            WebACL: 'MindBurnWAF',
            Region: this.region
          }
        })
      ]
    });

    // API Gateway 4xx/5xx Errors
    const apiErrorsWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        })
      ]
    });

    // Lambda Security Metrics
    const lambdaSecurityWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Security Events',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'ConcurrentExecutions',
          statistic: 'Maximum',
          period: cdk.Duration.minutes(5)
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        })
      ]
    });

    // KMS Metrics
    const kmsWidget = new cloudwatch.GraphWidget({
      title: 'KMS Key Usage',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/KMS',
          metricName: 'KeyUsage',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5)
        })
      ]
    });

    // VPC Flow Logs Widget
    const vpcFlowLogsWidget = new cloudwatch.LogQueryWidget({
      title: 'Suspicious VPC Traffic',
      logGroupNames: ['/aws/vpc/flowlogs'],
      queryLines: [
        'fields @timestamp, srcAddr, dstAddr, srcPort, dstPort, action',
        'filter action = "REJECT"',
        'sort @timestamp desc',
        'limit 100'
      ],
      width: 24,
      height: 6
    });

    // Add all widgets to dashboard
    dashboard.addWidgets(
      wafWidget,
      apiErrorsWidget,
      lambdaSecurityWidget,
      kmsWidget,
      vpcFlowLogsWidget
    );

    // Create CloudWatch Alarms
    new cloudwatch.Alarm(this, 'HighBlockedRequestsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          WebACL: 'MindBurnWAF',
          Region: this.region
        }
      }),
      threshold: 100,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'High number of blocked requests detected'
    });

    new cloudwatch.Alarm(this, 'AnomalousAPIUsageAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 1000,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Anomalous API usage detected'
    });
  }
} 