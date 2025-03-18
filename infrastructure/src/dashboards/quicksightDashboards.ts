import * as cdk from 'aws-cdk-lib';
import * as quicksight from 'aws-cdk-lib/aws-quicksight';
import { Construct } from 'constructs';

export class QuickSightDashboards extends Construct {
  constructor(scope: Construct, id: string, props: {
    dataSourceArn: string;
    dataSetArn: string;
    principalArn: string;
  }) {
    super(scope, id);

    // Executive Summary Dashboard
    new quicksight.CfnDashboard(this, 'ExecutiveSummaryDashboard', {
      awsAccountId: cdk.Stack.of(this).account,
      dashboardId: 'mindburn-executive-summary',
      name: 'Mindburn Executive Summary',
      permissions: [{
        principal: props.principalArn,
        actions: ['quicksight:DescribeDashboard', 'quicksight:ListDashboardVersions', 'quicksight:UpdateDashboardPermissions']
      }],
      sourceEntity: {
        sourceTemplate: {
          dataSetReferences: [{
            dataSetArn: props.dataSetArn,
            dataSetPlaceholder: 'verification_metrics'
          }],
          arn: props.dataSourceArn
        }
      },
      dashboardPublishOptions: {
        adHocFilteringOption: { availabilityStatus: 'ENABLED' },
        exportToCsvOption: { availabilityStatus: 'ENABLED' },
        sheetControlsOption: { visibilityState: 'EXPANDED' }
      },
      definition: {
        sheets: [{
          name: 'Overview',
          visuals: [
            {
              // Verification Accuracy Trend
              chartConfiguration: {
                type: 'LINE',
                xAxis: { field: 'timestamp' },
                yAxis: { field: 'accuracy_rate' },
                groupBy: ['verification_method']
              }
            },
            {
              // Cost per Verification Method
              chartConfiguration: {
                type: 'BAR',
                xAxis: { field: 'verification_method' },
                yAxis: { field: 'avg_cost' }
              }
            },
            {
              // Worker Performance Distribution
              chartConfiguration: {
                type: 'SCATTER',
                xAxis: { field: 'avg_response_time' },
                yAxis: { field: 'accuracy_rate' },
                size: { field: 'total_tasks' }
              }
            }
          ]
        }]
      }
    });

    // Operational Metrics Dashboard
    new quicksight.CfnDashboard(this, 'OperationalDashboard', {
      awsAccountId: cdk.Stack.of(this).account,
      dashboardId: 'mindburn-operational-metrics',
      name: 'Mindburn Operational Metrics',
      permissions: [{
        principal: props.principalArn,
        actions: ['quicksight:DescribeDashboard', 'quicksight:ListDashboardVersions', 'quicksight:UpdateDashboardPermissions']
      }],
      sourceEntity: {
        sourceTemplate: {
          dataSetReferences: [{
            dataSetArn: props.dataSetArn,
            dataSetPlaceholder: 'verification_metrics'
          }],
          arn: props.dataSourceArn
        }
      },
      definition: {
        sheets: [{
          name: 'Real-time Operations',
          visuals: [
            {
              // Response Time Distribution
              chartConfiguration: {
                type: 'HISTOGRAM',
                xAxis: { field: 'response_time_ms' },
                binCount: 20
              }
            },
            {
              // Task Queue Length
              chartConfiguration: {
                type: 'LINE',
                xAxis: { field: 'timestamp' },
                yAxis: { field: 'queue_length' }
              }
            },
            {
              // Active Workers
              chartConfiguration: {
                type: 'KPI',
                metric: 'active_workers',
                comparison: 'PREVIOUS_HOUR'
              }
            }
          ]
        }]
      }
    });

    // Quality Management Dashboard
    new quicksight.CfnDashboard(this, 'QualityDashboard', {
      awsAccountId: cdk.Stack.of(this).account,
      dashboardId: 'mindburn-quality-metrics',
      name: 'Mindburn Quality Management',
      permissions: [{
        principal: props.principalArn,
        actions: ['quicksight:DescribeDashboard', 'quicksight:ListDashboardVersions', 'quicksight:UpdateDashboardPermissions']
      }],
      sourceEntity: {
        sourceTemplate: {
          dataSetReferences: [{
            dataSetArn: props.dataSetArn,
            dataSetPlaceholder: 'verification_metrics'
          }],
          arn: props.dataSourceArn
        }
      },
      definition: {
        sheets: [{
          name: 'Quality Metrics',
          visuals: [
            {
              // Confidence Score Distribution
              chartConfiguration: {
                type: 'HISTOGRAM',
                xAxis: { field: 'confidence_score' },
                binCount: 10
              }
            },
            {
              // Error Rate by Content Type
              chartConfiguration: {
                type: 'BAR',
                xAxis: { field: 'content_type' },
                yAxis: { field: 'error_rate' }
              }
            },
            {
              // Quality Trend
              chartConfiguration: {
                type: 'LINE',
                xAxis: { field: 'timestamp' },
                yAxis: { field: 'accuracy_rate' },
                groupBy: ['content_type']
              }
            }
          ]
        }]
      }
    });
  }
} 