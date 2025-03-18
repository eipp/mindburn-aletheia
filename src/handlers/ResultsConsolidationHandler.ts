import { DynamoDB, SNS } from 'aws-sdk';
import { SQSEvent } from 'aws-lambda';

const dynamodb = new DynamoDB.DocumentClient();
const sns = new SNS();

interface VerificationResult {
  workerId: string;
  result: any;
  confidence: number;
  timestamp: string;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { taskId } = message;

      // Get all results for the task
      const results = await getTaskResults(taskId);
      if (!results.length) {
        console.log(`No results found for task ${taskId}`);
        continue;
      }

      // Get task details
      const task = await getTaskDetails(taskId);
      if (!task) {
        console.log(`Task ${taskId} not found`);
        continue;
      }

      // Check if we have enough results
      if (results.length < task.requiredVerifications) {
        console.log(`Not enough results for task ${taskId}`);
        continue;
      }

      // Consolidate results
      const consolidatedResult = await consolidateResults(taskId, results, task);

      // Update task with final result
      await updateTaskResult(taskId, consolidatedResult);

      // Update worker metrics
      await updateWorkerMetrics(results, consolidatedResult);

      // Notify task completion
      await notifyTaskCompletion(taskId, consolidatedResult);
    } catch (error) {
      console.error('Error consolidating results:', error);
      throw error;
    }
  }
};

async function getTaskResults(taskId: string): Promise<VerificationResult[]> {
  const result = await dynamodb
    .query({
      TableName: 'Results',
      KeyConditionExpression: 'taskId = :taskId',
      ExpressionAttributeValues: {
        ':taskId': taskId,
      },
    })
    .promise();

  return result.Items as VerificationResult[];
}

async function getTaskDetails(taskId: string): Promise<any> {
  const result = await dynamodb
    .get({
      TableName: 'Tasks',
      Key: { taskId },
    })
    .promise();

  return result.Item;
}

async function consolidateResults(
  taskId: string,
  results: VerificationResult[],
  task: any
): Promise<any> {
  // Weight results by worker confidence and historical accuracy
  const weightedResults = await Promise.all(
    results.map(async result => {
      const workerMetrics = await getWorkerMetrics(result.workerId);
      const weight = calculateResultWeight(result, workerMetrics);
      return { result: result.result, weight };
    })
  );

  // Aggregate results based on task type
  let aggregatedResult;
  switch (task.taskType) {
    case 'TEXT_VERIFICATION':
      aggregatedResult = aggregateTextResults(weightedResults);
      break;
    case 'IMAGE_VERIFICATION':
      aggregatedResult = aggregateImageResults(weightedResults);
      break;
    case 'CODE_VERIFICATION':
      aggregatedResult = aggregateCodeResults(weightedResults);
      break;
    default:
      throw new Error(`Unsupported task type: ${task.taskType}`);
  }

  // Calculate confidence score
  const confidenceScore = calculateConfidenceScore(weightedResults, aggregatedResult);

  return {
    result: aggregatedResult,
    confidence: confidenceScore,
    verificationCount: results.length,
    consensusReached: confidenceScore >= task.verificationCriteria.accuracy,
  };
}

async function getWorkerMetrics(workerId: string): Promise<any> {
  const result = await dynamodb
    .query({
      TableName: 'WorkerMetrics',
      KeyConditionExpression: 'workerId = :workerId',
      ExpressionAttributeValues: {
        ':workerId': workerId,
      },
    })
    .promise();

  return result.Items;
}

function calculateResultWeight(result: VerificationResult, metrics: any[]): number {
  const accuracyMetric = metrics.find(m => m.metricType === 'ACCURACY')?.value || 0.5;
  return result.confidence * 0.4 + accuracyMetric * 0.6;
}

function aggregateTextResults(weightedResults: any[]): any {
  // Implement text-specific aggregation logic
  // Example: weighted voting for text verification
  const votes: { [key: string]: number } = {};

  weightedResults.forEach(({ result, weight }) => {
    if (!votes[result]) votes[result] = 0;
    votes[result] += weight;
  });

  return Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0];
}

function aggregateImageResults(weightedResults: any[]): any {
  // Implement image-specific aggregation logic
  // Example: bounding box averaging for image verification
  return weightedResults.reduce(
    (acc, { result, weight }) => {
      return {
        boundingBox: {
          x: acc.boundingBox.x + result.boundingBox.x * weight,
          y: acc.boundingBox.y + result.boundingBox.y * weight,
          width: acc.boundingBox.width + result.boundingBox.width * weight,
          height: acc.boundingBox.height + result.boundingBox.height * weight,
        },
        labels: result.labels, // Use majority voting for labels
      };
    },
    { boundingBox: { x: 0, y: 0, width: 0, height: 0 }, labels: [] }
  );
}

function aggregateCodeResults(weightedResults: any[]): any {
  // Implement code-specific aggregation logic
  // Example: consensus on code correctness
  const totalWeight = weightedResults.reduce((sum, { weight }) => sum + weight, 0);
  const weightedSum = weightedResults.reduce((sum, { result, weight }) => {
    return sum + (result.isCorrect ? weight : 0);
  }, 0);

  return {
    isCorrect: weightedSum / totalWeight > 0.7,
    confidence: weightedSum / totalWeight,
  };
}

function calculateConfidenceScore(weightedResults: any[], aggregatedResult: any): number {
  // Calculate overall confidence based on agreement and individual confidences
  const totalWeight = weightedResults.reduce((sum, { weight }) => sum + weight, 0);
  const agreementWeight = weightedResults.reduce((sum, { result, weight }) => {
    return sum + (result === aggregatedResult ? weight : 0);
  }, 0);

  return agreementWeight / totalWeight;
}

async function updateTaskResult(taskId: string, consolidatedResult: any): Promise<void> {
  await dynamodb
    .update({
      TableName: 'Tasks',
      Key: { taskId },
      UpdateExpression:
        'SET #status = :status, aggregatedResult = :result, confidence = :confidence, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': consolidatedResult.consensusReached ? 'COMPLETED' : 'FAILED',
        ':result': consolidatedResult.result,
        ':confidence': consolidatedResult.confidence,
        ':completedAt': new Date().toISOString(),
      },
    })
    .promise();
}

async function updateWorkerMetrics(
  results: VerificationResult[],
  consolidatedResult: any
): Promise<void> {
  const updates = results.map(result => {
    const accuracy = calculateWorkerAccuracy(result.result, consolidatedResult.result);
    return updateWorkerAccuracyMetric(result.workerId, accuracy);
  });

  await Promise.all(updates);
}

function calculateWorkerAccuracy(workerResult: any, consolidatedResult: any): number {
  // Implement accuracy calculation based on result type
  // This is a simplified example
  return workerResult === consolidatedResult ? 1 : 0;
}

async function updateWorkerAccuracyMetric(workerId: string, accuracy: number): Promise<void> {
  await dynamodb
    .update({
      TableName: 'WorkerMetrics',
      Key: {
        workerId,
        metricType: 'ACCURACY',
      },
      UpdateExpression: 'SET #value = :newValue',
      ExpressionAttributeNames: {
        '#value': 'value',
      },
      ExpressionAttributeValues: {
        ':newValue': accuracy,
      },
    })
    .promise();
}

async function notifyTaskCompletion(taskId: string, consolidatedResult: any): Promise<void> {
  await sns
    .publish({
      TopicArn: process.env.TASK_COMPLETION_TOPIC!,
      Message: JSON.stringify({
        type: 'TASK_COMPLETED',
        taskId,
        result: consolidatedResult,
      }),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: taskId,
        },
      },
    })
    .promise();
}
