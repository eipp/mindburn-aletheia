import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createLogger } from '../shared';

const logger = createLogger('WebSocketEvents');
const sqs = new SQSClient({});
const QUEUE_URL = process.env.WEBSOCKET_EVENTS_QUEUE_URL!;

// Define supported event types
export type WebSocketEventType = 
  | 'TASK_CREATED' 
  | 'TASK_ASSIGNED' 
  | 'TASK_COMPLETED'
  | 'TASK_REJECTED'
  | 'PAYMENT_PROCESSED';

/**
 * Send a WebSocket event to be broadcast to subscribed clients
 * 
 * @param type Event type from the supported WebSocketEventType enum
 * @param data Event data to be sent to clients
 * @param filter Optional filter criteria to limit recipients
 * @returns Message ID from SQS
 */
export async function sendWebSocketEvent(
  type: WebSocketEventType,
  data: any,
  filter?: Record<string, any>
): Promise<string> {
  logger.info('Sending WebSocket event', { type });
  
  try {
    const payload = {
      type,
      data,
      filter,
      timestamp: Date.now()
    };
    
    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: type
        }
      }
    });
    
    const result = await sqs.send(command);
    
    logger.info('WebSocket event sent', { 
      type, 
      messageId: result.MessageId 
    });
    
    return result.MessageId || '';
  } catch (error: any) {
    logger.error('Failed to send WebSocket event', { 
      type, 
      error: error.message 
    });
    
    throw new Error(`Failed to send WebSocket event: ${error.message}`);
  }
}

/**
 * Send a task created event
 * 
 * @param taskId ID of the created task
 * @param task Task data
 * @param developerId Developer ID (for filtering)
 * @returns Message ID from SQS
 */
export function sendTaskCreatedEvent(taskId: string, task: any, developerId: string): Promise<string> {
  return sendWebSocketEvent('TASK_CREATED', {
    taskId,
    ...task
  }, {
    developerId
  });
}

/**
 * Send a task assigned event
 * 
 * @param taskId ID of the assigned task
 * @param workerId Worker ID that was assigned
 * @param developerId Developer ID (for filtering)
 * @returns Message ID from SQS
 */
export function sendTaskAssignedEvent(taskId: string, workerId: string, developerId: string): Promise<string> {
  return sendWebSocketEvent('TASK_ASSIGNED', {
    taskId,
    workerId,
    assignedAt: new Date().toISOString()
  }, {
    developerId
  });
}

/**
 * Send a task completed event
 * 
 * @param taskId ID of the completed task
 * @param result Task result data
 * @param developerId Developer ID (for filtering) 
 * @returns Message ID from SQS
 */
export function sendTaskCompletedEvent(taskId: string, result: any, developerId: string): Promise<string> {
  return sendWebSocketEvent('TASK_COMPLETED', {
    taskId,
    result,
    completedAt: new Date().toISOString()
  }, {
    developerId
  });
}

/**
 * Send a task rejected event
 * 
 * @param taskId ID of the rejected task
 * @param reason Rejection reason
 * @param workerId Worker ID that rejected the task
 * @param developerId Developer ID (for filtering)
 * @returns Message ID from SQS
 */
export function sendTaskRejectedEvent(
  taskId: string, 
  reason: string, 
  workerId: string,
  developerId: string
): Promise<string> {
  return sendWebSocketEvent('TASK_REJECTED', {
    taskId,
    reason,
    workerId,
    rejectedAt: new Date().toISOString()
  }, {
    developerId
  });
}

/**
 * Send a payment processed event
 * 
 * @param paymentId ID of the processed payment
 * @param payment Payment data
 * @param developerId Developer ID (for filtering)
 * @returns Message ID from SQS
 */
export function sendPaymentProcessedEvent(
  paymentId: string,
  payment: any,
  developerId: string
): Promise<string> {
  return sendWebSocketEvent('PAYMENT_PROCESSED', {
    paymentId,
    ...payment,
    processedAt: new Date().toISOString()
  }, {
    developerId
  });
} 