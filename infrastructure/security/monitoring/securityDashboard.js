"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityDashboardStack = void 0;
const cdk = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
class SecurityDashboardStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const dashboard = new cloudwatch.Dashboard(this, 'SecurityDashboard', {
            dashboardName: 'MindBurn-Security-Dashboard',
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
                        Region: this.region,
                    },
                }),
            ],
        });
        // API Gateway 4xx/5xx Errors
        const apiErrorsWidget = new cloudwatch.GraphWidget({
            title: 'API Gateway Errors',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/ApiGateway',
                    metricName: '4XXError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/ApiGateway',
                    metricName: '5XXError',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
            ],
        });
        // Lambda Security Metrics
        const lambdaSecurityWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Security Events',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'ConcurrentExecutions',
                    statistic: 'Maximum',
                    period: cdk.Duration.minutes(5),
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Throttles',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
            ],
        });
        // KMS Metrics
        const kmsWidget = new cloudwatch.GraphWidget({
            title: 'KMS Key Usage',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/KMS',
                    metricName: 'KeyUsage',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
            ],
        });
        // VPC Flow Logs Widget
        const vpcFlowLogsWidget = new cloudwatch.LogQueryWidget({
            title: 'Suspicious VPC Traffic',
            logGroupNames: ['/aws/vpc/flowlogs'],
            queryLines: [
                'fields @timestamp, srcAddr, dstAddr, srcPort, dstPort, action',
                'filter action = "REJECT"',
                'sort @timestamp desc',
                'limit 100',
            ],
            width: 24,
            height: 6,
        });
        // Add all widgets to dashboard
        dashboard.addWidgets(wafWidget, apiErrorsWidget, lambdaSecurityWidget, kmsWidget, vpcFlowLogsWidget);
        // Create CloudWatch Alarms
        new cloudwatch.Alarm(this, 'HighBlockedRequestsAlarm', {
            metric: new cloudwatch.Metric({
                namespace: 'AWS/WAFV2',
                metricName: 'BlockedRequests',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
                dimensionsMap: {
                    WebACL: 'MindBurnWAF',
                    Region: this.region,
                },
            }),
            threshold: 100,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'High number of blocked requests detected',
        });
        new cloudwatch.Alarm(this, 'AnomalousAPIUsageAlarm', {
            metric: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: 1000,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'Anomalous API usage detected',
        });
    }
}
exports.SecurityDashboardStack = SecurityDashboardStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHlEYXNoYm9hcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eURhc2hib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMseURBQXlEO0FBR3pELE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3BFLGFBQWEsRUFBRSw2QkFBNkI7U0FDN0MsQ0FBQyxDQUFDO1FBRUgsY0FBYztRQUNkLE1BQU0sU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUMzQyxLQUFLLEVBQUUsc0JBQXNCO1lBQzdCLElBQUksRUFBRTtnQkFDSixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7b0JBQ3BCLFNBQVMsRUFBRSxXQUFXO29CQUN0QixVQUFVLEVBQUUsaUJBQWlCO29CQUM3QixTQUFTLEVBQUUsS0FBSztvQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsYUFBYSxFQUFFO3dCQUNiLE1BQU0sRUFBRSxhQUFhO3dCQUNyQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07cUJBQ3BCO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILDZCQUE2QjtRQUM3QixNQUFNLGVBQWUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDakQsS0FBSyxFQUFFLG9CQUFvQjtZQUMzQixJQUFJLEVBQUU7Z0JBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO29CQUNwQixTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixVQUFV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QzdELENBQUMsQ0FBQztRQUVILElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDbkQsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFLE9BQU87Z0JBQ25CLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsSUFBSTtZQUNmLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLHNCQUFzQjtZQUN4RSxnQkFBZ0IsRUFBRSw4QkFBOEI7U0FDakQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbElELHdEQWtJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlEYXNoYm9hcmRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnU2VjdXJpdHlEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiAnTWluZEJ1cm4tU2VjdXJpdHktRGFzaGJvYXJkJyxcbiAgICB9KTtcblxuICAgIC8vIFdBRiBNZXRyaWNzXG4gICAgY29uc3Qgd2FmV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdXQUYgQmxvY2tlZCBSZXF1ZXN0cycsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL1dBRlYyJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnQmxvY2tlZFJlcXVlc3RzJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgV2ViQUNMOiAnTWluZEJ1cm5XQUYnLFxuICAgICAgICAgICAgUmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSA0eHgvNXh4IEVycm9yc1xuICAgIGNvbnN0IGFwaUVycm9yc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgRXJyb3JzJyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIFNlY3VyaXR5IE1ldHJpY3NcbiAgICBjb25zdCBsYW1iZGFTZWN1cml0eVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRhIFNlY3VyaXR5IEV2ZW50cycsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0NvbmN1cnJlbnRFeGVjdXRpb25zJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnVGhyb3R0bGVzJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEtNUyBNZXRyaWNzXG4gICAgY29uc3Qga21zV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdLTVMgS2V5IFVzYWdlJyxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvS01TJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnS2V5VXNhZ2UnLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gVlBDIEZsb3cgTG9ncyBXaWRnZXRcbiAgICBjb25zdCB2cGNGbG93TG9nc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkxvZ1F1ZXJ5V2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnU3VzcGljaW91cyBWUEMgVHJhZmZpYycsXG4gICAgICBsb2dHcm91cE5hbWVzOiBbJy9hd3MvdnBjL2Zsb3dsb2dzJ10sXG4gICAgICBxdWVyeUxpbmVzOiBbXG4gICAgICAgICdmaWVsZHMgQHRpbWVzdGFtcCwgc3JjQWRkciwgZHN0QWRkciwgc3JjUG9ydCwgZHN0UG9ydCwgYWN0aW9uJyxcbiAgICAgICAgJ2ZpbHRlciBhY3Rpb24gPSBcIlJFSkVDVFwiJyxcbiAgICAgICAgJ3NvcnQgQHRpbWVzdGFtcCBkZXNjJyxcbiAgICAgICAgJ2xpbWl0IDEwMCcsXG4gICAgICBdLFxuICAgICAgd2lkdGg6IDI0LFxuICAgICAgaGVpZ2h0OiA2LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGFsbCB3aWRnZXRzIHRvIGRhc2hib2FyZFxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgd2FmV2lkZ2V0LFxuICAgICAgYXBpRXJyb3JzV2lkZ2V0LFxuICAgICAgbGFtYmRhU2VjdXJpdHlXaWRnZXQsXG4gICAgICBrbXNXaWRnZXQsXG4gICAgICB2cGNGbG93TG9nc1dpZGdldFxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBBbGFybXNcbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaEJsb2NrZWRSZXF1ZXN0c0FsYXJtJywge1xuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvV0FGVjInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQmxvY2tlZFJlcXVlc3RzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIFdlYkFDTDogJ01pbmRCdXJuV0FGJyxcbiAgICAgICAgICBSZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDEwMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbnVtYmVyIG9mIGJsb2NrZWQgcmVxdWVzdHMgZGV0ZWN0ZWQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0Fub21hbG91c0FQSVVzYWdlQWxhcm0nLCB7XG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0NvdW50JyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxMDAwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQW5vbWFsb3VzIEFQSSB1c2FnZSBkZXRlY3RlZCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==