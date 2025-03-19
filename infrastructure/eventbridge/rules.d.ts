import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
export declare function createMetricsAnalysisRule(stack: cdk.Stack, metricsAnalysisFunction: lambda.Function): events.Rule;
