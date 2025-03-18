import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  alertEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Log Groups with 30-day retention
    const logGroups = {
      workerInterface: new logs.LogGroup(this, 'WorkerInterfaceLogGroup', {
        logGroupName: `/aletheia/${props.environment}/worker-interface`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      workerWebapp: new logs.LogGroup(this, 'WorkerWebappLogGroup', {
        logGroupName: `/aletheia/${props.environment}/worker-webapp`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      xray: new logs.LogGroup(this, 'XRayLogGroup', {
        logGroupName: `/aletheia/${props.environment}/xray`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
    };

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: `Aletheia-${props.environment}-Alerts`,
    });

    alertTopic.addSubscription(
      new subscriptions.EmailSubscription(props.alertEmail)
    );

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'MainDashboard', {
      dashboardName: `Aletheia-${props.environment}-Dashboard`,
    });

    // API Metrics Widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: {
              ApiName: `aletheia-${props.environment}-api`,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: {
              ApiName: `aletheia-${props.environment}-api`,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );

    // Lambda Metrics Widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );

    // Alarms
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: `aletheia-${props.environment}-api`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'API has high error rate',
    });

    apiErrorAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    // Cost monitoring
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `Aletheia-${props.environment}-Monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: props.environment === 'prod' ? 1000 : 500,
          unit: 'USD',
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              address: props.alertEmail,
              subscriptionType: 'EMAIL',
            },
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
    });
  }
} 