import { Queue } from 'aws-cdk-lib/aws-sqs';
export declare const createTaskQueues: (scope: any) => {
    taskAssignmentQueue: Queue;
    taskExpirationQueue: Queue;
    resultsProcessingQueue: Queue;
    taskDLQ: Queue;
    resultsDLQ: Queue;
};
