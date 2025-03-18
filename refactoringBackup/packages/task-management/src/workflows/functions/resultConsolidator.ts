import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { Task, TaskStatus } from '../../types';

const logger = createLogger('ResultConsolidator');
const dynamodb = new DynamoDB.DocumentClient();

interface VerificationResult {
  workerId: string;
  result: any;
  confidence: number;
  timeSpent: number;
  metadata: Record<string, any>;
}

interface ResultConsolidatorInput {
  taskId: string;
  verificationRequirements: {
    verificationThreshold: number;
  };
}

interface ResultConsolidatorOutput {
  taskId: string;
  status: TaskStatus;
  consolidatedResult: {
    result: any;
    confidence: number;
    verifierCount: number;
    timeSpentAvg: number;
    metadata: Record<string, any>;
  };
  verificationResults: VerificationResult[];
  error?: string;
}

export const handler = async (event: ResultConsolidatorInput): Promise<ResultConsolidatorOutput> => {
  try {
    logger.info('Consolidating verification results', { taskId: event.taskId });

    // Get task from DynamoDB
    const result = await dynamodb.get({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: event.taskId }
    }).promise();

    const task = result.Item as Task & { verificationResults?: VerificationResult[] };
      if (!task) {
      throw new Error(`Task not found: ${event.taskId}`);
    }

    if (!task.verificationResults || task.verificationResults.length === 0) {
      throw new Error(`No verification results found for task: ${event.taskId}`);
    }

    // Ensure we have enough verifications
    if (task.verificationResults.length < event.verificationRequirements.verificationThreshold) {
      throw new Error(`Insufficient verifications: ${task.verificationResults.length} < ${event.verificationRequirements.verificationThreshold}`);
    }

    // Consolidate results
    const consolidatedResult = await consolidateResults(task.verificationResults);

      // Update task with consolidated results
    await updateTaskWithResults(task.taskId, consolidatedResult, task.verificationResults);

      return {
      taskId: task.taskId,
      status: TaskStatus.VERIFICATION_COMPLETE,
      consolidatedResult,
      verificationResults: task.verificationResults
    };

    } catch (error) {
    logger.error('Failed to consolidate results', { error, taskId: event.taskId });

    // Update task status to failed
    await dynamodb.update({
      TableName: process.env.TASKS_TABLE!,
      Key: { taskId: event.taskId },
      UpdateExpression: 'SET #status = :status, statusReason = :reason, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.FAILED,
        ':reason': error instanceof Error ? error.message : 'Unknown error during result consolidation',
        ':now': new Date().toISOString()
      }
    }).promise();

      throw error;
  }
};

async function consolidateResults(results: VerificationResult[]): Promise<ResultConsolidatorOutput['consolidatedResult']> {
  // Group results by their values
  const resultGroups = results.reduce((groups, result) => {
    const key = JSON.stringify(result.result);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(result);
    return groups;
  }, {} as Record<string, VerificationResult[]>);

  // Find the most common result
  let mostCommonResult: any;
  let maxCount = 0;
  let totalConfidence = 0;
  let totalTimeSpent = 0;

  for (const [key, group] of Object.entries(resultGroups)) {
    if (group.length > maxCount) {
      maxCount = group.length;
      mostCommonResult = JSON.parse(key);
    }
    group.forEach(result => {
      totalConfidence += result.confidence;
      totalTimeSpent += result.timeSpent;
    });
  }

  // Calculate averages and combine metadata
  const avgConfidence = totalConfidence / results.length;
  const avgTimeSpent = totalTimeSpent / results.length;
  const combinedMetadata = results.reduce((metadata, result) => {
    return { ...metadata, ...result.metadata };
  }, {});

    return {
    result: mostCommonResult,
    confidence: avgConfidence,
    verifierCount: results.length,
    timeSpentAvg: avgTimeSpent,
    metadata: combinedMetadata
  };
}

async function updateTaskWithResults(
  taskId: string,
  consolidatedResult: ResultConsolidatorOutput['consolidatedResult'],
  verificationResults: VerificationResult[]
): Promise<void> {
  await dynamodb.update({
    TableName: process.env.TASKS_TABLE!,
    Key: { taskId },
    UpdateExpression: `
      SET #status = :status,
          consolidatedResult = :consolidatedResult,
          verificationResults = :verificationResults,
          updatedAt = :now
    `,
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': TaskStatus.VERIFICATION_COMPLETE,
      ':consolidatedResult': consolidatedResult,
      ':verificationResults': verificationResults,
      ':now': new Date().toISOString()
    }
  }).promise();
} 