import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
interface SecurityStackProps extends cdk.StackProps {
    environment: string;
    accountId: string;
}
export declare class MainSecurityStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SecurityStackProps);
}
export {};
