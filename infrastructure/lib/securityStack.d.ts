import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
export interface SecurityStackProps extends cdk.StackProps {
    environment: string;
    adminEmail: string;
}
export declare class SecurityStack extends cdk.Stack {
    readonly encryptionKey: kms.Key;
    readonly userPool: cognito.UserPool;
    readonly apiWaf: wafv2.CfnWebACL;
    constructor(scope: Construct, id: string, props: SecurityStackProps);
}
