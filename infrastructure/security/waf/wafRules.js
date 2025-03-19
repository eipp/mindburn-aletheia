"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WafStack = void 0;
const cdk = require("aws-cdk-lib");
const wafv2 = require("aws-cdk-lib/aws-wafv2");
class WafStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.WafStack = WafStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FmUnVsZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3YWZSdWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsK0NBQStDO0FBRy9DLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsaUJBQWlCO1FBQ2pCLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3RELGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDNUIsS0FBSyxFQUFFLFVBQVU7WUFDakIsZ0JBQWdCLEVBQUU7Z0JBQ2hCLHdCQUF3QixFQUFFLElBQUk7Z0JBQzlCLFVBQVUsRUFBRSxvQkFBb0I7Z0JBQ2hDLHNCQUFzQixFQUFFLElBQUk7YUFDN0I7WUFDRCxLQUFLLEVBQUU7Z0JBQ0wscUJBQXFCO2dCQUNyQjtvQkFDRSxJQUFJLEVBQUUsV0FBVztvQkFDakIsUUFBUSxFQUFFLENBQUM7b0JBQ1gsU0FBUyxFQUFFO3dCQUNULGtCQUFrQixFQUFFOzRCQUNsQixLQUFLLEVBQUUsSUFBSTs0QkFDWCxnQkFBZ0IsRUFBRSxJQUFJO3lCQUN2QjtxQkFDRjtvQkFDRCxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO29CQUNyQixnQkFBZ0IsRUFBRTt3QkFDaEIsd0JBQXdCLEVBQUUsSUFBSTt3QkFDOUIsVUFBVSxFQUFFLGlCQUFpQjt3QkFDN0Isc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7Z0JBQ0QsNkJBQTZCO2dCQUM3QjtvQkFDRSxJQUFJLEVBQUUsOEJBQThCO29CQUNwQyxRQUFRLEVBQUUsQ0FBQztvQkFDWCxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO29CQUM1QixTQUFTLEVBQUU7d0JBQ1QseUJBQXlCLEVBQUU7NEJBQ3pCLFVBQVUsRUFBRSxLQUFLOzRCQUNqQixJQUFJLEVBQUUsOEJBQThCO3lCQUNyQztxQkFDRjtvQkFDRCxnQkFBZ0IsRUFBRTt3QkFDaEIsd0JBQXdCLEVBQUUsSUFBSTt3QkFDOUIsVUFBVSxFQUFFLG9DQUFvQzt3QkFDaEQsc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7Z0JBQ0QsMkJBQTJCO2dCQUMzQjtvQkFDRSxJQUFJLEVBQUUsNEJBQTRCO29CQUNsQyxRQUFRLEVBQUUsQ0FBQztvQkFDWCxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO29CQUM1QixTQUFTLEVBQUU7d0JBQ1QseUJBQXlCLEVBQUU7NEJBQ3pCLFVBQVUsRUFBRSxLQUFLOzRCQUNqQixJQUFJLEVBQUUsNEJBQTRCO3lCQUNuQztxQkFDRjtvQkFDRCxnQkFBZ0IsRUFBRTt3QkFDaEIsd0JBQXdCLEVBQUUsSUFBSTt3QkFDOUIsVUFBVSxFQUFFLGtDQUFrQzt3QkFDOUMsc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7Z0JBQ0QsdUJBQXVCO2dCQUN2QjtvQkFDRSxJQUFJLEVBQUUsZUFBZTtvQkFDckIsUUFBUSxFQUFFLENBQUM7b0JBQ1gsU0FBUyxFQUFFO3dCQUNULFdBQVcsRUFBRTs0QkFDWCxVQUFVLEVBQUU7Z0NBQ1Y7b0NBQ0UsdUJBQXVCLEVBQUU7d0NBQ3ZCLGtCQUFrQixFQUFFLElBQUk7d0NBQ3hCLElBQUksRUFBRSxJQUFJO3dDQUNWLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7d0NBQzFCLG1CQUFtQixFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztxQ0FDckQ7aUNBQ0Y7Z0NBQ0Q7b0NBQ0UsaUJBQWlCLEVBQUU7d0NBQ2pCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7d0NBQzFCLG1CQUFtQixFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxDQUFDO3FDQUNuRTtpQ0FDRjs2QkFDRjt5QkFDRjtxQkFDRjtvQkFDRCxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO29CQUNyQixnQkFBZ0IsRUFBRTt3QkFDaEIsd0JBQXdCLEVBQUUsSUFBSTt3QkFDOUIsVUFBVSxFQUFFLHFCQUFxQjt3QkFDakMsc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUNwQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsQyxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU07WUFDcEIsV0FBVyxFQUFFLGdCQUFnQjtTQUM5QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6R0QsNEJBeUdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHdhZnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy13YWZ2Mic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIFdhZlN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIFdBRiBBQ0xcbiAgICBjb25zdCB3ZWJBY2wgPSBuZXcgd2FmdjIuQ2ZuV2ViQUNMKHRoaXMsICdNaW5kQnVybldBRicsIHtcbiAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sXG4gICAgICBzY29wZTogJ1JFR0lPTkFMJyxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTWluZEJ1cm5XQUZNZXRyaWNzJyxcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBydWxlczogW1xuICAgICAgICAvLyBSYXRlIGxpbWl0aW5nIHJ1bGVcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdSYXRlTGltaXQnLFxuICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIGxpbWl0OiAyMDAwLFxuICAgICAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiAnSVAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmF0ZUxpbWl0TWV0cmljJyxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQVdTIE1hbmFnZWQgUnVsZXMgLSBDb21tb25cbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0JyxcbiAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICBvdmVycmlkZUFjdGlvbjogeyBub25lOiB7fSB9LFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgbWFuYWdlZFJ1bGVHcm91cFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICB2ZW5kb3JOYW1lOiAnQVdTJyxcbiAgICAgICAgICAgICAgbmFtZTogJ0FXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0TWV0cmljJyxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gU1FMIEluamVjdGlvbiBQcmV2ZW50aW9uXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXQnLFxuICAgICAgICAgIHByaW9yaXR5OiAzLFxuICAgICAgICAgIG92ZXJyaWRlQWN0aW9uOiB7IG5vbmU6IHt9IH0sXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIHZlbmRvck5hbWU6ICdBV1MnLFxuICAgICAgICAgICAgICBuYW1lOiAnQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdBV1NNYW5hZ2VkUnVsZXNTUUxpUnVsZVNldE1ldHJpYycsXG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIEJhZCBJbnB1dCBQcmV2ZW50aW9uXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnQmFkSW5wdXRzUnVsZScsXG4gICAgICAgICAgcHJpb3JpdHk6IDQsXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBvclN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgc2l6ZUNvbnN0cmFpbnRTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiAnR1QnLFxuICAgICAgICAgICAgICAgICAgICBzaXplOiA4MTkyLFxuICAgICAgICAgICAgICAgICAgICBmaWVsZFRvTWF0Y2g6IHsgYm9keToge30gfSxcbiAgICAgICAgICAgICAgICAgICAgdGV4dFRyYW5zZm9ybWF0aW9uczogW3sgcHJpb3JpdHk6IDEsIHR5cGU6ICdOT05FJyB9XSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB4c3NNYXRjaFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgICAgICBmaWVsZFRvTWF0Y2g6IHsgYm9keToge30gfSxcbiAgICAgICAgICAgICAgICAgICAgdGV4dFRyYW5zZm9ybWF0aW9uczogW3sgcHJpb3JpdHk6IDEsIHR5cGU6ICdIVE1MX0VOVElUWV9ERUNPREUnIH1dLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQmFkSW5wdXRzUnVsZU1ldHJpYycsXG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IFdBRiBBQ0wgSURcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViQWNsSWQnLCB7XG4gICAgICB2YWx1ZTogd2ViQWNsLmF0dHJJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV0FGIFdlYiBBQ0wgSUQnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=