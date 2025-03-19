"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPerformanceDashboard = createPerformanceDashboard;
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
function createPerformanceDashboard(stack) {
    const dashboard = new cloudwatch.Dashboard(stack, 'PerformanceDashboard', {
        dashboardName: 'MindBurnAletheia-Performance',
    });
    // API Gateway Metrics
    const apiMetrics = new cloudwatch.GraphWidget({
        title: 'API Gateway Performance',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Latency',
                statistic: 'p95',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '4XXError',
                statistic: 'sum',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5XXError',
                statistic: 'sum',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                statistic: 'sum',
            }),
        ],
    });
    // Lambda Performance
    const lambdaMetrics = new cloudwatch.GraphWidget({
        title: 'Lambda Performance',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'p95',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                statistic: 'sum',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'ConcurrentExecutions',
                statistic: 'max',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Throttles',
                statistic: 'sum',
            }),
        ],
    });
    // DynamoDB Performance
    const dynamoMetrics = new cloudwatch.GraphWidget({
        title: 'DynamoDB Performance',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'SuccessfulRequestLatency',
                statistic: 'p95',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ThrottledRequests',
                statistic: 'sum',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                statistic: 'sum',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                statistic: 'sum',
            }),
        ],
    });
    // Custom Business Metrics
    const businessMetrics = new cloudwatch.GraphWidget({
        title: 'Business Metrics',
        left: [
            new cloudwatch.Metric({
                namespace: 'MindBurnAletheia',
                metricName: 'VerificationProcessingTime',
                statistic: 'p95',
            }),
            new cloudwatch.Metric({
                namespace: 'MindBurnAletheia',
                metricName: 'VerificationAccuracy',
                statistic: 'average',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'MindBurnAletheia',
                metricName: 'TasksProcessed',
                statistic: 'sum',
            }),
            new cloudwatch.Metric({
                namespace: 'MindBurnAletheia',
                metricName: 'WorkerUtilization',
                statistic: 'average',
            }),
        ],
    });
    // Cost Metrics
    const costMetrics = new cloudwatch.GraphWidget({
        title: 'Cost Metrics',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                statistic: 'maximum',
            }),
        ],
    });
    dashboard.addWidgets(apiMetrics, lambdaMetrics, dynamoMetrics, businessMetrics, costMetrics);
    return dashboard;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVyZm9ybWFuY2VEYXNoYm9hcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwZXJmb3JtYW5jZURhc2hib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUdBLGdFQXdJQztBQTFJRCx5REFBeUQ7QUFFekQsU0FBZ0IsMEJBQTBCLENBQUMsS0FBZ0I7SUFDekQsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxzQkFBc0IsRUFBRTtRQUN4RSxhQUFhLEVBQUUsOEJBQThCO0tBQzlDLENBQUMsQ0FBQztJQUVILHNCQUFzQjtJQUN0QixNQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7UUFDNUMsS0FBSyxFQUFFLHlCQUF5QjtRQUNoQyxJQUFJLEVBQUU7WUFDSixJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxnQkFBZ0I7Z0JBQzNCLFVBQVUsRUFBRSxTQUFTO2dCQUNyQixTQUFTLEVBQUUsS0FBSzthQUNqQixDQUFDO1lBQ0YsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUNwQixTQUFTLEVBQUUsZ0JBQWdCO2dCQUMzQixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsU0FBUyxFQUFFLEtBQUs7YUFDakIsQ0FBQztZQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDcEIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLFNBQVMsRUFBRSxLQUFLO2FBQ2pCLENBQUM7U0FDSDtRQUNELEtBQUssRUFBRTtZQUNMLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDcEIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFLE9BQU87Z0JBQ25CLFNBQVMsRUFBRSxLQUFLO2FBQ2pCLENBQUM7U0FDSDtLQUNGLENBQUMsQ0FBQztJQUVILHFCQUFxQjtJQUNyQixNQUFNLGFBQWEsR0FBRyxJQUFJLFVB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QUM7Z0JBQ3BCLFNBQVMsRUFBRSxhQUFhO2dCQUN4QixVQUFVLEVBQUUsa0JBQWtCO2dCQUM5QixTQUFTLEVBQUUsU0FBUzthQUNyQixDQUFDO1NBQ0g7S0FDRixDQUFDLENBQUM7SUFFSCxTQUFTLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU3RixPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGVyZm9ybWFuY2VEYXNoYm9hcmQoc3RhY2s6IGNkay5TdGFjayk6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkIHtcbiAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHN0YWNrLCAnUGVyZm9ybWFuY2VEYXNoYm9hcmQnLCB7XG4gICAgZGFzaGJvYXJkTmFtZTogJ01pbmRCdXJuQWxldGhlaWEtUGVyZm9ybWFuY2UnLFxuICB9KTtcblxuICAvLyBBUEkgR2F0ZXdheSBNZXRyaWNzXG4gIGNvbnN0IGFwaU1ldHJpY3MgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBQZXJmb3JtYW5jZScsXG4gICAgbGVmdDogW1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5NScsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSksXG4gICAgXSxcbiAgICByaWdodDogW1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQ291bnQnLFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSksXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gTGFtYmRhIFBlcmZvcm1hbmNlXG4gIGNvbnN0IGxhbWJkYU1ldHJpY3MgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgdGl0bGU6ICdMYW1iZGEgUGVyZm9ybWFuY2UnLFxuICAgIGxlZnQ6IFtcbiAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICBzdGF0aXN0aWM6ICdwOTUnLFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9ycycsXG4gICAgICAgIHN0YXRpc3RpYzogJ3N1bScsXG4gICAgICB9KSxcbiAgICBdLFxuICAgIHJpZ2h0OiBbXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0NvbmN1cnJlbnRFeGVjdXRpb25zJyxcbiAgICAgICAgc3RhdGlzdGljOiAnbWF4JyxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdUaHJvdHRsZXMnLFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSksXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gRHluYW1vREIgUGVyZm9ybWFuY2VcbiAgY29uc3QgZHluYW1vTWV0cmljcyA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICB0aXRsZTogJ0R5bmFtb0RCIFBlcmZvcm1hbmNlJyxcbiAgICBsZWZ0OiBbXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnU3VjY2Vzc2Z1bFJlcXVlc3RMYXRlbmN5JyxcbiAgICAgICAgc3RhdGlzdGljOiAncDk1JyxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1Rocm90dGxlZFJlcXVlc3RzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgcmlnaHQ6IFtcbiAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9EeW5hbW9EQicsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pLFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIEN1c3RvbSBCdXNpbmVzcyBNZXRyaWNzXG4gIGNvbnN0IGJ1c2luZXNzTWV0cmljcyA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICB0aXRsZTogJ0J1c2luZXNzIE1ldHJpY3MnLFxuICAgIGxlZnQ6IFtcbiAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ01pbmRCdXJuQWxldGhlaWEnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnVmVyaWZpY2F0aW9uUHJvY2Vzc2luZ1RpbWUnLFxuICAgICAgICBzdGF0aXN0aWM6ICdwOTUnLFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdNaW5kQnVybkFsZXRoZWlhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1ZlcmlmaWNhdGlvbkFjY3VyYWN5JyxcbiAgICAgICAgc3RhdGlzdGljOiAnYXZlcmFnZScsXG4gICAgICB9KSxcbiAgICBdLFxuICAgIHJpZ2h0OiBbXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdNaW5kQnVybkFsZXRoZWlhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1Rhc2tzUHJvY2Vzc2VkJyxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnTWluZEJ1cm5BbGV0aGVpYScsXG4gICAgICAgIG1ldHJpY05hbWU6ICdXb3JrZXJVdGlsaXphdGlvbicsXG4gICAgICAgIHN0YXRpc3RpYzogJ2F2ZXJhZ2UnLFxuICAgICAgfSksXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gQ29zdCBNZXRyaWNzXG4gIGNvbnN0IGNvc3RNZXRyaWNzID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgIHRpdGxlOiAnQ29zdCBNZXRyaWNzJyxcbiAgICBsZWZ0OiBbXG4gICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQmlsbGluZycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdFc3RpbWF0ZWRDaGFyZ2VzJyxcbiAgICAgICAgc3RhdGlzdGljOiAnbWF4aW11bScsXG4gICAgICB9KSxcbiAgICBdLFxuICB9KTtcblxuICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhhcGlNZXRyaWNzLCBsYW1iZGFNZXRyaWNzLCBkeW5hbW9NZXRyaWNzLCBidXNpbmVzc01ldHJpY3MsIGNvc3RNZXRyaWNzKTtcblxuICByZXR1cm4gZGFzaGJvYXJkO1xufVxuIl19