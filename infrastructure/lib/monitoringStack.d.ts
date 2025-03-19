import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface MonitoringStackProps extends cdk.StackProps {
    environment: string;
    alertEmail: string;
}
export declare class MonitoringStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
