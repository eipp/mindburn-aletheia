"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
const cdk = require("aws-cdk-lib");
const logs = require("aws-cdk-lib/aws-logs");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const sns = require("aws-cdk-lib/aws-sns");
const subscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const budgets = require("aws-cdk-lib/aws-budgets");
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        alertTopic.addSubscription(new subscriptions.EmailSubscription(props.alertEmail));
        // CloudWatch Dashboard
        const dashboard = new cloudwatch.Dashboard(this, 'MainDashboard', {
            dashboardName: `Aletheia-${props.environment}-Dashboard`,
        });
        // API Metrics Widget
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }), new cloudwatch.GraphWidget({
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
        }));
        // Lambda Metrics Widget
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Lambda Duration',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Duration',
                    statistic: 'Average',
                    period: cdk.Duration.minutes(1),
                }),
            ],
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Errors',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Errors',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(1),
                }),
            ],
        }));
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
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZ1N0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9uaXRvcmluZ1N0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyw2Q0FBNkM7QUFDN0MseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyxtRUFBbUU7QUFDbkUsbURBQW1EO0FBUW5ELE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1DQUFtQztRQUNuQyxNQUFNLFNBQVMsR0FBRztZQUNoQixlQUFlLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtnQkFDbEUsWUFBWSxFQUFFLGFBQWEsS0FBSyxDQUFDLFdBQVcsbUJBQW1CO2dCQUMvRCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO2FBQ3hDLENBQUM7WUFDRixZQUFZLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtnQkFDNUQsWUFBWSxFQUFFLGFBQWEsS0FBSyxDQUFDLFdBQVcsZ0JBQWdCO2dCQUM1RCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO2FBQ3hDLENBQUM7WUFDRixJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7Z0JBQzVDLFlBQVksRUFBRSxhQUFhLEtBQUssQ0FBQyxXQUFXLE9BQU87Z0JBQ25ELFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7YUFDeEMsQ0FBQztTQUNILENBQUM7UUFFRix1QkFBdUI7UUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkQsV0FBVyxFQUFFLFlBQVksS0FBSyxDQUFDLFdBQVcsU0FBUztTQUNwRCxDQUFDLENBQUM7UUFFSCxVQUFVLENBQUMsZUFBZSxDQUFDLElBQUksYUFBYSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRWxGLHVCQUF1QjtRQUN2QixNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNoRSxhQUFhLEVBQUUsWUFBWSxLQUFLLENBQUMsV0FBVyxZQUFZO1NBQ3pELENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGFBQWE7WUFDcEIsSUFBSSxFQUFFO2dCQUNKLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLGdCQUFnQjtvQkFDM0IsVUFBVSxFQUFFLFNBQVM7b0JBQ3JCLGFBQWEsRUFBRTt3QkFDYixPQUFPLEVBQUUsWUFBWSxLQUFLLENBQUMsV0FBVyxNQUFNO3FCQUM3QztvQkFDRCxTQUFTLEVBQUUsU0FBUztvQkFDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDaEMsQ0FBQzthQUNIO1NBQ0YsQ0FBQyxFQUNGLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUN6QixLQUFLLEVBQUUsWUFBWTtZQUNuQixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFVLEVBQUUsVUFBVTtvQkFDdEIsYUFBYSxFQUFFO3dCQUNiLE9BQU8sRUFBRSxZQUFZLEtBQUssQ0FBQyxXQUFXLE1BQU07cUJBQzdDO29CQUNELFNBQVMsRUFBRSxLQUFLO29CQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2FBQ0g7U0FDRixDQUFDLENBQ0gsQ0FBQztRQUVGLHdCQUF3QjtRQUN4QixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekIsS0FBSyxFQUFFLGlCQUFpQjtZQUN4QixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsWUFBWTtvQkFDdkIsVUFBVSxFQUFFLFVBQVU7b0JBQ3RCLFNBQVMsRUFBRSxTQUFTO29CQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUNoQyxDQUFDO2FBQ0g7U0FDRixDQUFDLEVBQ0YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3pCLEtBQUssRUFBRSxlQUFlO1lBQ3RCLElBQUksRUFBRTtnQkFDSixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxZQUFZO29CQUN2QixVQUFVLEVBQUUsUUFBUTtvQkFDcEIsU0FBUyxFQUFFLEtBQUs7b0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQ2hDLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsU0FBUztRQUNULE1BQU0sYUFBYSxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ2hFLE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSxnQkFBZ0I7Z0JBQzNCLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixhQUFhLEVBQUU7b0JBQ2IsT0FBTyxFQUFFLFlBQVksS0FBSyxDQUFDLFdBQVcsTUFBTTtpQkFDN0M7Z0JBQ0QsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztZQUNGLFNBQVMsRUFBRSxDQUFDO1lBQ1osaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSx5QkFBeUI7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUVuRSxrQkFBa0I7UUFDbEIsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDM0MsTUFBTSxFQUFFO2dCQUNOLFVBQVUsRUFBRSxZQUFZLEtBQUssQ0FBQyxXQUFXLFVBQVU7Z0JBQ25ELFVBQVUsRUFBRSxNQUFNO2dCQUNsQixRQUFRLEVBQUUsU0FBUztnQkFDbkIsV0FBVyxFQUFFO29CQUNYLE1BQU0sRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHO29CQUNqRCxJQUFJLEVBQUUsS0FBSztpQkFDWjthQUNGO1lBQ0QsNEJBQTRCLEVBQUU7Z0JBQzVCO29CQUNFLFlBQVksRUFBRTt3QkFDWixrQkFBa0IsRUFBRSxjQUFjO3dCQUNsQyxnQkFBZ0IsRUFBRSxRQUFRO3dCQUMxQixTQUFTLEVBQUUsRUFBRTt3QkFDYixhQUFhLEVBQUUsWUFBWTtxQkFDNUI7b0JBQ0QsV0FBVyxFQUFFO3dCQUNYOzRCQUNFLE9BQU8sRUFBRSxLQUFLLENBQUMsVUFBVTs0QkFDekIsZ0JBQWdCLEVBQUUsT0FBTzt5QkFDMUI7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUseURBQXlELElBQUksQ0FBQyxNQUFNLG9CQUFvQixTQUFTLENBQUMsYUFBYSxFQUFFO1NBQ3pILENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTlJRCwwQ0E4SUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGJ1ZGdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJ1ZGdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9uaXRvcmluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGFsZXJ0RW1haWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBNb25pdG9yaW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gTG9nIEdyb3VwcyB3aXRoIDMwLWRheSByZXRlbnRpb25cbiAgICBjb25zdCBsb2dHcm91cHMgPSB7XG4gICAgICB3b3JrZXJJbnRlcmZhY2U6IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdXb3JrZXJJbnRlcmZhY2VMb2dHcm91cCcsIHtcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2FsZXRoZWlhLyR7cHJvcHMuZW52aXJvbm1lbnR9L3dvcmtlci1pbnRlcmZhY2VgLFxuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICB9KSxcbiAgICAgIHdvcmtlcldlYmFwcDogbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1dvcmtlcldlYmFwcExvZ0dyb3VwJywge1xuICAgICAgICBsb2dHcm91cE5hbWU6IGAvYWxldGhlaWEvJHtwcm9wcy5lbnZpcm9ubWVudH0vd29ya2VyLXdlYmFwcGAsXG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIH0pLFxuICAgICAgeHJheTogbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1hSYXlMb2dHcm91cCcsIHtcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2FsZXRoZWlhLyR7cHJvcHMuZW52aXJvbm1lbnR9L3hyYXlgLFxuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgLy8gU05TIFRvcGljIGZvciBhbGVydHNcbiAgICBjb25zdCBhbGVydFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQWxlcnRUb3BpYycsIHtcbiAgICAgIGRpc3BsYXlOYW1lOiBgQWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tQWxlcnRzYCxcbiAgICB9KTtcblxuICAgIGFsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLmFsZXJ0RW1haWwpKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdNYWluRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYEFsZXRoZWlhLSR7cHJvcHMuZW52aXJvbm1lbnR9LURhc2hib2FyZGAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgTWV0cmljcyBXaWRnZXRcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBBcGlOYW1lOiBgYWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tYXBpYCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgRXJyb3JzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBBcGlOYW1lOiBgYWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tYXBpYCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBNZXRyaWNzIFdpZGdldFxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0xhbWJkYSBEdXJhdGlvbicsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnTGFtYmRhIEVycm9ycycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JzJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWxhcm1zXG4gICAgY29uc3QgYXBpRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGlFcnJvckFsYXJtJywge1xuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBBcGlOYW1lOiBgYWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tYXBpYCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIGhhcyBoaWdoIGVycm9yIHJhdGUnLFxuICAgIH0pO1xuXG4gICAgYXBpRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaC5TbnNBY3Rpb24oYWxlcnRUb3BpYykpO1xuXG4gICAgLy8gQ29zdCBtb25pdG9yaW5nXG4gICAgbmV3IGJ1ZGdldHMuQ2ZuQnVkZ2V0KHRoaXMsICdNb250aGx5QnVkZ2V0Jywge1xuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIGJ1ZGdldE5hbWU6IGBBbGV0aGVpYS0ke3Byb3BzLmVudmlyb25tZW50fS1Nb250aGx5YCxcbiAgICAgICAgYnVkZ2V0VHlwZTogJ0NPU1QnLFxuICAgICAgICB0aW1lVW5pdDogJ01PTlRITFknLFxuICAgICAgICBidWRnZXRMaW1pdDoge1xuICAgICAgICAgIGFtb3VudDogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDEwMDAgOiA1MDAsXG4gICAgICAgICAgdW5pdDogJ1VTRCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbm90aWZpY2F0aW9uc1dpdGhTdWJzY3JpYmVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6ICdHUkVBVEVSX1RIQU4nLFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogJ0FDVFVBTCcsXG4gICAgICAgICAgICB0aHJlc2hvbGQ6IDgwLFxuICAgICAgICAgICAgdGhyZXNob2xkVHlwZTogJ1BFUkNFTlRBR0UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Vic2NyaWJlcnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgYWRkcmVzczogcHJvcHMuYWxlcnRFbWFpbCxcbiAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uVHlwZTogJ0VNQUlMJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7ZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICB9KTtcbiAgfVxufVxuIl19