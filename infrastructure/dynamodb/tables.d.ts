import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
export declare const createTasksTable: (scope: any, id: string) => Table;
export declare const createWorkersTable: (scope: any, id: string) => Table;
export declare const createResultsTable: (scope: any, id: string) => Table;
export declare const createMetricsTable: (scope: any, id: string) => Table;
export declare function createVerificationCacheTable(stack: cdk.Stack): dynamodb.Table;
export declare function createGoldenSetTable(stack: cdk.Stack): dynamodb.Table;
export declare function createWorkerActivitiesTable(stack: cdk.Stack): dynamodb.Table;
export declare function createWorkerMetricsTable(stack: cdk.Stack): dynamodb.Table;
export declare function createConsolidatedResultsTable(stack: cdk.Stack): dynamodb.Table;
export declare function createInsightsTable(stack: cdk.Stack): dynamodb.Table;
