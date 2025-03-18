import { Handler } from 'aws-lambda';
import { TONIntegrationService } from '../services/ton-integration';
import { PaymentBatchModel } from '../models/payment-batch';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('ProcessPaymentBatches');
const tonService = new TONIntegrationService();
const batchModel = new PaymentBatchModel();

export const handler: Handler = async event => {
  try {
    logger.info('Starting to process pending payment batches');

    // Get pending batches
    const pendingBatches = await batchModel.listPending();
    logger.info(`Found ${pendingBatches.length} pending batches`);

    if (pendingBatches.length === 0) {
      return { statusCode: 200, body: 'No pending batches to process' };
    }

    // Process each batch
    const results = await Promise.allSettled(
      pendingBatches.map(async batch => {
        try {
          logger.info(`Processing batch ${batch.batchId}`);

          // Update batch status to processing
          await batchModel.update(batch.batchId, { status: 'processing' });

          // Process the batch
          const result = await tonService.processPaymentBatch({ batchId: batch.batchId });

          logger.info(`Batch ${batch.batchId} processed`, { result });
          return result;
        } catch (error) {
          logger.error(`Error processing batch ${batch.batchId}`, { error });

          // Mark batch as failed
          await batchModel.update(batch.batchId, {
            status: 'failed',
            processedAt: new Date().toISOString(),
          });

          throw error;
        }
      })
    );

    // Summarize results
    const summary = {
      total: results.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };

    logger.info('Batch processing completed', { summary });

    return {
      statusCode: 200,
      body: JSON.stringify(summary),
    };
  } catch (error) {
    logger.error('Error in batch processing handler', { error });
    throw error;
  }
};
