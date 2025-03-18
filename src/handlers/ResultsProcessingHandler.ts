import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDB, SNS } from 'aws-sdk';
import { VerificationStrategy } from '../verification/types';

interface ResultProcessingMessage {
  taskId: string;
  taskType: string;
  strategy: VerificationStrategy;
  requiredVerifications: number;
  notifyEndpoint?: string;
}

interface VerificationResult {
  taskId: string;
  workerId: string;
  decision: 'APPROVED' | 'REJECTED';
  confidence: number;
  explanation: string;
  contributors: any[];
  timestamp: number;
}

interface ConsolidatedResult {
  taskId: string;
  finalDecision: 'APPROVED' | 'REJECTED';
  confidence: number;
  explanation: string;
  verifications: VerificationResult[];
  strategy: VerificationStrategy;
  processingTime: number;
  timestamp: number;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const dynamodb = new DynamoDB.DocumentClient();
  const sns = new SNS();

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as ResultProcessingMessage;
      const startTime = Date.now();

      // Get all verifications for the task
      const verifications = await getTaskVerifications(message.taskId);

      // Check if we have enough verifications
      if (verifications.length < message.requiredVerifications) {
        // Requeue message with backoff if not enough verifications
        await requeueMessage(record, message);
        continue;
      }

      // Consolidate results
      const consolidatedResult = await consolidateResults(
        message,
        verifications,
        startTime
      );

      // Save consolidated result
      await saveConsolidatedResult(consolidatedResult);

      // Update task status
      await updateTaskStatus(
        message.taskId,
        consolidatedResult.finalDecision,
        consolidatedResult.confidence
      );

      // Notify if endpoint provided
      if (message.notifyEndpoint) {
        await notifyCompletion(message.notifyEndpoint, consolidatedResult);
      }
    } catch (error) {
      console.error('Error processing record:', error);
      throw error; // Let SQS handle retry
    }
  }
};

async function getTaskVerifications(taskId: string): Promise<VerificationResult[]> {
  const dynamodb = new DynamoDB.DocumentClient();

  const result = await dynamodb.query({
    TableName: 'Results',
    KeyConditionExpression: 'taskId = :taskId',
    ExpressionAttributeValues: {
      ':taskId': taskId
    }
  }).promise();

  return result.Items as VerificationResult[];
}

async function consolidateResults(
  message: ResultProcessingMessage,
  verifications: VerificationResult[],
  startTime: number
): Promise<ConsolidatedResult> {
  // Calculate weighted decisions based on confidence
  const totalWeight = verifications.reduce((sum, v) => sum + v.confidence, 0);
  const approvalWeight = verifications
    .filter(v => v.decision === 'APPROVED')
    .reduce((sum, v) => sum + v.confidence, 0);

  // Calculate final decision and confidence
  const approvalRatio = approvalWeight / totalWeight;
  const finalDecision = approvalRatio >= 0.5 ? 'APPROVED' : 'REJECTED';
  const confidence = Math.abs(approvalRatio - 0.5) * 2; // Scale to 0-1

  // Generate comprehensive explanation
  const explanation = generateConsolidatedExplanation(
    verifications,
    finalDecision,
    confidence,
    message.strategy
  );

  return {
    taskId: message.taskId,
    finalDecision,
    confidence,
    explanation,
    verifications,
    strategy: message.strategy,
    processingTime: Date.now() - startTime,
    timestamp: Date.now()
  };
}

function generateConsolidatedExplanation(
  verifications: VerificationResult[],
  finalDecision: 'APPROVED' | 'REJECTED',
  confidence: number,
  strategy: VerificationStrategy
): string {
  const totalVerifiers = verifications.length;
  const approvedCount = verifications.filter(v => v.decision === 'APPROVED').length;
  const rejectedCount = totalVerifiers - approvedCount;

  // Get key explanations from high-confidence verifications
  const keyExplanations = verifications
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(v => v.explanation)
    .join(' ');

  return `Final decision: ${finalDecision} with ${(confidence * 100).toFixed(1)}% confidence. ` +
         `Based on ${totalVerifiers} verifications using ${strategy} strategy. ` +
         `${approvedCount} approved, ${rejectedCount} rejected. ` +
         `Key observations: ${keyExplanations}`;
}

async function saveConsolidatedResult(result: ConsolidatedResult): Promise<void> {
  const dynamodb = new DynamoDB.DocumentClient();

  try {
    await dynamodb.put({
      TableName: 'ConsolidatedResults',
      Item: result
    }).promise();
  } catch (error) {
    console.error('Error saving consolidated result:', error);
    throw error;
  }
}

async function updateTaskStatus(
  taskId: string,
  decision: 'APPROVED' | 'REJECTED',
  confidence: number
): Promise<void> {
  const dynamodb = new DynamoDB.DocumentClient();

  try {
    await dynamodb.update({
      TableName: 'Tasks',
      Key: { taskId },
      UpdateExpression: 'SET #status = :status, confidence = :confidence, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
        ':confidence': confidence,
        ':completedAt': Date.now()
      }
    }).promise();
  } catch (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
}

async function notifyCompletion(
  endpoint: string,
  result: ConsolidatedResult
): Promise<void> {
  const sns = new SNS();

  try {
    await sns.publish({
      TopicArn: endpoint,
      Message: JSON.stringify({
        type: 'VERIFICATION_COMPLETE',
        data: {
          taskId: result.taskId,
          decision: result.finalDecision,
          confidence: result.confidence,
          explanation: result.explanation,
          timestamp: result.timestamp
        }
      })
    }).promise();
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw error for notification failure
  }
}

async function requeueMessage(
  record: SQSRecord,
  message: ResultProcessingMessage
): Promise<void> {
  const sqs = new AWS.SQS();
  const visibilityTimeout = parseInt(record.attributes.ApproximateReceiveCount) * 60; // Exponential backoff

  try {
    await sqs.changeMessageVisibility({
      QueueUrl: process.env.RESULTS_QUEUE_URL!,
      ReceiptHandle: record.receiptHandle,
      VisibilityTimeout: visibilityTimeout
    }).promise();
  } catch (error) {
    console.error('Error requeuing message:', error);
    throw error;
  }
} 