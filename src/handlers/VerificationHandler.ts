import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { VerificationEngine } from '../verification/VerificationEngine';
import { FraudDetector } from '../verification/FraudDetector';
import { MetricsCollector } from '../verification/MetricsCollector';
import {
  VerificationStrategy,
  VerificationConfig,
  VerificationContext,
} from '../verification/types';

interface VerificationRequest {
  taskId: string;
  taskType: string;
  content: any;
  workerId?: string;
  strategy?: VerificationStrategy;
  config?: Partial<VerificationConfig>;
  context?: Partial<VerificationContext>;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const request = JSON.parse(event.body || '{}') as VerificationRequest;

    // Validate request
    if (!request.taskId || !request.taskType || !request.content) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: taskId, taskType, content',
        }),
      };
    }

    // Initialize components
    const verificationEngine = new VerificationEngine();
    const fraudDetector = new FraudDetector();
    const metricsCollector = new MetricsCollector();

    // Start verification process
    const startTime = Date.now();
    let verificationResult;

    try {
      // If worker verification, check for fraud first
      if (request.workerId) {
        const fraudCheck = await fraudDetector.detectFraud(
          request.workerId,
          request.taskId,
          request.taskType,
          'PENDING', // Will be updated after verification
          0 // Processing time will be calculated at the end
        );

        if (fraudCheck.isFraudulent) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              error: 'Suspicious activity detected',
              details: fraudCheck.reasons,
            }),
          };
        }
      }

      // Perform verification
      verificationResult = await verificationEngine.verify({
        taskId: request.taskId,
        taskType: request.taskType,
        content: request.content,
        workerId: request.workerId,
        strategy: request.strategy,
        config: request.config || {},
        context: request.context || {},
      });

      // Update metrics if worker verification
      if (request.workerId) {
        const processingTime = Date.now() - startTime;

        // Update fraud check with actual decision
        await fraudDetector.detectFraud(
          request.workerId,
          request.taskId,
          request.taskType,
          verificationResult.decision,
          processingTime
        );

        // Update worker metrics
        await metricsCollector.updateMetrics(request.workerId);
      }

      // Save verification result
      await saveVerificationResult(request, verificationResult);

      return {
        statusCode: 200,
        body: JSON.stringify({
          taskId: request.taskId,
          result: verificationResult,
        }),
      };
    } catch (error) {
      console.error('Verification error:', error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Verification process failed',
          details: error.message,
        }),
      };
    }
  } catch (error) {
    console.error('Handler error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};

async function saveVerificationResult(request: VerificationRequest, result: any): Promise<void> {
  const dynamodb = new DynamoDB.DocumentClient();

  const item = {
    taskId: request.taskId,
    workerId: request.workerId || 'SYSTEM',
    taskType: request.taskType,
    decision: result.decision,
    confidence: result.confidence,
    explanation: result.explanation,
    processingTime: result.processingTime,
    contributors: result.contributors,
    timestamp: Date.now(),
  };

  try {
    await dynamodb
      .put({
        TableName: 'Results',
        Item: item,
      })
      .promise();
  } catch (error) {
    console.error('Error saving verification result:', error);
    throw error;
  }
}
