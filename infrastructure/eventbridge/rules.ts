import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export function createMetricsAnalysisRule(
  stack: cdk.Stack,
  metricsAnalysisFunction: lambda.Function
): events.Rule {
  return new events.Rule(stack, 'MetricsAnalysisRule', {
    schedule: events.Schedule.rate(cdk.Duration.hours(24)),
    targets: [new targets.LambdaFunction(metricsAnalysisFunction)],
    description: 'Triggers daily metrics analysis for the verification system',
    enabled: true
  });
} 