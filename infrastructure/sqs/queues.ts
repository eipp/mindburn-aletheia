import { Duration } from 'aws-cdk-lib';
import { DeadLetterQueue, Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';

export const createTaskQueues = (scope: any) => {
  // DLQ for failed task assignments
  const taskDLQ = new Queue(scope, 'TaskAssignmentDLQ', {
    queueName: 'task-assignment-dlq',
    encryption: QueueEncryption.KMS_MANAGED,
    retentionPeriod: Duration.days(14)
  });

  // Main task assignment queue
  const taskAssignmentQueue = new Queue(scope, 'TaskAssignmentQueue', {
    queueName: 'task-assignment-queue',
    encryption: QueueEncryption.KMS_MANAGED,
    visibilityTimeout: Duration.minutes(5),
    deadLetterQueue: {
      queue: taskDLQ,
      maxReceiveCount: 3
    }
  });

  // Task expiration queue with delayed processing
  const taskExpirationQueue = new Queue(scope, 'TaskExpirationQueue', {
    queueName: 'task-expiration-queue',
    encryption: QueueEncryption.KMS_MANAGED,
    visibilityTimeout: Duration.minutes(5),
    deadLetterQueue: {
      queue: taskDLQ,
      maxReceiveCount: 3
    }
  });

  // Results processing queue
  const resultsDLQ = new Queue(scope, 'ResultsProcessingDLQ', {
    queueName: 'results-processing-dlq',
    encryption: QueueEncryption.KMS_MANAGED,
    retentionPeriod: Duration.days(14)
  });

  const resultsProcessingQueue = new Queue(scope, 'ResultsProcessingQueue', {
    queueName: 'results-processing-queue',
    encryption: QueueEncryption.KMS_MANAGED,
    visibilityTimeout: Duration.minutes(10),
    deadLetterQueue: {
      queue: resultsDLQ,
      maxReceiveCount: 3
    }
  });

  return {
    taskAssignmentQueue,
    taskExpirationQueue,
    resultsProcessingQueue,
    taskDLQ,
    resultsDLQ
  };
}; 