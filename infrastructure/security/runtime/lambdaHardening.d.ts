import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export declare class LambdaHardeningStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
    static applyHardening(fn: lambda.Function): void;
}
