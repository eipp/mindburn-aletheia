import { SQSHandler } from 'aws-lambda';
import { createLogger } from '../shared';
import { broadcastToSubscribers } from './index';

const logger = createLogger('WebSocketBroadcaster');

interface EventPayload {
  type: string;
  data: any;
  filter?: Record<string, any>;
}

/**
 * SQS handler for broadcasting messages to WebSocket connections
 * This handler processes events from SQS and broadcasts them to subscribed WebSocket clients
 */
export const handler: SQSHandler = async (event) => {
  logger.info('Processing WebSocket broadcast events', { records: event.Records.length });
  
  const results = {
    processed: 0,
    failed: 0,
    sent: 0,
    errors: [] as string[]
  };
  
  // Process each SQS message
  for (const record of event.Records) {
    try {
      // Parse the payload
      const payload: EventPayload = JSON.parse(record.body);
      
      // Validate the payload
      if (!payload.type) {
        logger.warn('Invalid payload: missing type', { messageId: record.messageId });
        results.failed++;
        results.errors.push(`Message ${record.messageId}: missing event type`);
        continue;
      }
      
      logger.info('Broadcasting event', { 
        type: payload.type, 
        messageId: record.messageId,
        hasFilter: !!payload.filter
      });
      
      // Broadcast the message to all subscribed connections
      const broadcastResult = await broadcastToSubscribers(
        payload.type,
        payload.data,
        payload.filter
      );
      
      results.sent += broadcastResult.sent;
      results.processed++;
      
      logger.info('Broadcast result', { 
        type: payload.type,
        sent: broadcastResult.sent,
        failures: broadcastResult.failures
      });
    } catch (error: any) {
      logger.error('Failed to process broadcast message', { 
        messageId: record.messageId,
        error: error.message
      });
      
      results.failed++;
      results.errors.push(`Message ${record.messageId}: ${error.message}`);
    }
  }
  
  logger.info('Broadcast processing complete', { 
    total: event.Records.length,
    processed: results.processed,
    failed: results.failed,
    sent: results.sent
  });
  
  // If any messages failed, throw an error to trigger SQS retry
  if (results.failed > 0) {
    throw new Error(`Failed to process ${results.failed} messages: ${results.errors.join('; ')}`);
  }
  
  return results;
}; 