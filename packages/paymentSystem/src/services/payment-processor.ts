import { DynamoDB } from 'aws-sdk';
import { TONIntegrationService } from './ton-integration';
import { createLogger } from '@mindburn/shared';
import { KMS } from 'aws-sdk';
import { TonClient, Address, toNano } from '@ton/ton';
import { PaymentBatch, PaymentStatus, PaymentTransaction } from '../types';
import { retry } from '@mindburn/shared/utils';
import { PaymentError } from '../errors';

const logger = createLogger('PaymentProcessorService');

interface TaskRewardPayment {
  taskId: string;
  workerId: string;
  amount: number;
  status: 'approved' | 'rejected' | 'partial';
  qualityFactor?: number;
}

interface BatchPayment {
  paymentIds: string[];
  processingPriority?: 'normal' | 'high';
}

interface WithdrawalRequest {
  workerId: string;
  amount: number;
  destinationAddress: string;
  withdrawalId?: string;
}

export class PaymentProcessorService {
  private dynamoDB: DynamoDB.DocumentClient;
  private tonService: TONIntegrationService;
  private kms: KMS;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_INTERVAL = 300000; // 5 minutes
  private readonly HIGH_PRIORITY_INTERVAL = 60000; // 1 minute
  private readonly batchSize: number = 100;
  private readonly maxRetries: number = 3;

  constructor() {
    this.dynamoDB = new DynamoDB.DocumentClient();
    this.kms = new KMS();
    this.tonService = new TONIntegrationService();
  }

  async processTaskReward(payment: TaskRewardPayment) {
    try {
      logger.info('Processing task reward payment', { payment });

      // Calculate adjusted amount based on quality
      const adjustedAmount = payment.qualityFactor
        ? payment.amount * payment.qualityFactor
        : payment.amount;

      // Create payment record
      const paymentId = `payment_${Date.now()}_${payment.taskId}`;
      await this.dynamoDB
        .put({
          TableName: process.env.PAYMENTS_TABLE!,
          Item: {
            paymentId,
            taskId: payment.taskId,
            workerId: payment.workerId,
            originalAmount: payment.amount,
            adjustedAmount,
            status: 'pending',
            processingStrategy: adjustedAmount > 100 ? 'immediate' : 'batched',
            createdAt: new Date().toISOString(),
          },
        })
        .promise();

      // Process large payments immediately
      if (adjustedAmount > 100) {
        await this.processSinglePayment(paymentId);
      }

      return {
        paymentId,
        taskId: payment.taskId,
        workerId: payment.workerId,
        originalAmount: payment.amount,
        adjustedAmount,
        status: 'pending',
        processingStrategy: adjustedAmount > 100 ? 'immediate' : 'batched',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process task reward', { error, payment });
      throw error;
    }
  }

  async processBulkPayments(batch: BatchPayment) {
    try {
      logger.info('Processing bulk payments', { batch });

      const batchId = `batch_${Date.now()}`;
      let totalAmount = 0;
      let successful = 0;
      let failed = 0;
      const failedPaymentIds: string[] = [];

      // Process payments in chunks
      for (let i = 0; i < batch.paymentIds.length; i += this.BATCH_SIZE) {
        const chunk = batch.paymentIds.slice(i, i + this.BATCH_SIZE);
        const payments = await this.getPaymentsByIds(chunk);

        // Create TON transaction batch
        const tonBatch = await this.processPayments(payments);

        totalAmount += tonBatch.totalAmount;

        // Process the batch
        const result = await this.processBatchWithRetry(tonBatch.successful);

        successful += result.successful.length;
        failed += result.failed.length;
        failedPaymentIds.push(...result.failed.map(t => t.referenceId!));

        // Update payment statuses
        await this.updatePaymentStatuses(result.successful);
      }

      return {
        batchId,
        paymentCount: batch.paymentIds.length,
        totalAmount,
        status: failed === 0 ? 'completed' : 'partial_failure',
        results: {
          successful,
          failed,
          failedPaymentIds,
        },
        queuedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process bulk payments', { error, batch });
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const result = await this.dynamoDB
        .get({
          TableName: process.env.PAYMENTS_TABLE!,
          Key: { paymentId },
        })
        .promise();

      if (!result.Item) {
        throw new Error('Payment not found');
      }

      return result.Item;
    } catch (error) {
      logger.error('Failed to get payment status', { error, paymentId });
      throw error;
    }
  }

  async getWorkerBalance(workerId: string) {
    try {
      const result = await this.dynamoDB
        .get({
          TableName: process.env.WORKERS_TABLE!,
          Key: { workerId },
        })
        .promise();

      if (!result.Item) {
        throw new Error('Worker not found');
      }

      const pendingPayments = await this.getPendingPayments(workerId);
      const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.adjustedAmount, 0);

      return {
        workerId,
        availableBalance: result.Item.balance || 0,
        pendingBalance: pendingAmount,
        totalEarned: result.Item.totalEarned || 0,
        lastUpdatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get worker balance', { error, workerId });
      throw error;
    }
  }

  async processWithdrawal(request: WithdrawalRequest) {
    try {
      logger.info('Processing withdrawal request', { request });

      // Validate balance
      const balance = await this.getWorkerBalance(request.workerId);
      if (balance.availableBalance < request.amount) {
        throw new Error('Insufficient balance');
      }

      // Validate address
      const addressValidation = await this.tonService.validateTONAddress({
        address: request.destinationAddress,
      });
      if (!addressValidation.valid) {
        throw new Error('Invalid TON address');
      }

      // Create withdrawal record
      const withdrawalId = request.withdrawalId || `withdrawal_${Date.now()}_${request.workerId}`;
      const fee = await this.calculateWithdrawalFee(request.amount);
      const netAmount = request.amount - fee;

      await this.dynamoDB
        .put({
          TableName: process.env.WITHDRAWALS_TABLE!,
          Item: {
            withdrawalId,
            workerId: request.workerId,
            amount: request.amount,
            fee,
            netAmount,
            destinationAddress: request.destinationAddress,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        })
        .promise();

      // Process withdrawal
      const transaction = await this.tonService.sendTONPayment({
        destinationAddress: request.destinationAddress,
        amount: netAmount,
        message: `Withdrawal ${withdrawalId}`,
        referenceId: withdrawalId,
      });

      // Update withdrawal status
      await this.updateWithdrawalStatus(withdrawalId, transaction);

      return {
        withdrawalId,
        workerId: request.workerId,
        amount: request.amount,
        fee,
        netAmount,
        destinationAddress: request.destinationAddress,
        status: transaction.status,
        transactionHash: transaction.transactionHash,
        estimatedCompletionTime: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process withdrawal', { error, request });
      throw error;
    }
  }

  private async processSinglePayment(paymentId: string) {
    const payment = await this.getPaymentStatus(paymentId);
    const worker = await this.getWorkerData(payment.workerId);

    const transaction = await this.tonService.sendTONPayment({
      destinationAddress: worker.walletAddress,
      amount: payment.adjustedAmount,
      message: `Task reward ${payment.taskId}`,
      referenceId: paymentId,
    });

    await this.updatePaymentStatus(paymentId, transaction);
  }

  private async getPaymentsByIds(paymentIds: string[]) {
    const results = await Promise.all(paymentIds.map(id => this.getPaymentStatus(id)));
    return results.filter(p => p.status === 'pending');
  }

  private async updatePaymentStatuses(transactions: any[]) {
    await Promise.all(
      transactions.map(tx =>
        this.updatePaymentStatus(tx.referenceId!, {
          status: tx.status,
          transactionHash: tx.transactionHash,
        })
      )
    );
  }

  private async updatePaymentStatus(paymentId: string, transaction: any) {
    await this.dynamoDB
      .update({
        TableName: process.env.PAYMENTS_TABLE!,
        Key: { paymentId },
        UpdateExpression: 'SET #status = :status, transactionHash = :txHash, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': transaction.status,
          ':txHash': transaction.transactionHash,
          ':now': new Date().toISOString(),
        },
      })
      .promise();
  }

  private async updateWithdrawalStatus(withdrawalId: string, transaction: any) {
    await this.dynamoDB
      .update({
        TableName: process.env.WITHDRAWALS_TABLE!,
        Key: { withdrawalId },
        UpdateExpression: 'SET #status = :status, transactionHash = :txHash, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': transaction.status,
          ':txHash': transaction.transactionHash,
          ':now': new Date().toISOString(),
        },
      })
      .promise();
  }

  private async getPendingPayments(workerId: string) {
    const result = await this.dynamoDB
      .query({
        TableName: process.env.PAYMENTS_TABLE!,
        IndexName: 'WorkerIdStatusIndex',
        KeyConditionExpression: 'workerId = :workerId AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':workerId': workerId,
          ':status': 'pending',
        },
      })
      .promise();

    return result.Items || [];
  }

  private async getWorkerData(workerId: string) {
    const result = await this.dynamoDB
      .get({
        TableName: process.env.WORKERS_TABLE!,
        Key: { workerId },
      })
      .promise();

    if (!result.Item) {
      throw new Error('Worker not found');
    }

    return result.Item;
  }

  private async calculateWithdrawalFee(amount: number) {
    // Implement dynamic fee calculation based on network conditions
    return Math.max(0.1, amount * 0.01); // Minimum 0.1 TON or 1%
  }

  async processPayments(payments: PaymentTransaction[]): Promise<PaymentBatch> {
    try {
      logger.info('Starting payment batch processing', { count: payments.length });

      // Group payments by recipient for batching
      const batches = this.createPaymentBatches(payments);

      // Process each batch with retries
      const results = await Promise.all(batches.map(batch => this.processBatchWithRetry(batch)));

      // Aggregate results
      const successfulPayments = results.flatMap(r => r.successful);
      const failedPayments = results.flatMap(r => r.failed);

      return {
        batchId: Date.now().toString(),
        status: failedPayments.length === 0 ? PaymentStatus.COMPLETED : PaymentStatus.PARTIAL,
        successful: successfulPayments,
        failed: failedPayments,
        totalAmount: this.calculateTotalAmount(successfulPayments),
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process payment batch', { error });
      throw new PaymentError('Payment batch processing failed', { cause: error });
    }
  }

  private createPaymentBatches(payments: PaymentTransaction[]): PaymentTransaction[][] {
    const batches: PaymentTransaction[][] = [];
    for (let i = 0; i < payments.length; i += this.batchSize) {
      batches.push(payments.slice(i, i + this.batchSize));
    }
    return batches;
  }

  private async processBatchWithRetry(batch: PaymentTransaction[]) {
    return retry(async () => this.processBatch(batch), {
      maxRetries: this.maxRetries,
      backoff: 'exponential',
      logger: logger,
    });
  }

  private async processBatch(batch: PaymentTransaction[]) {
    const successful: PaymentTransaction[] = [];
    const failed: PaymentTransaction[] = [];

    for (const payment of batch) {
      try {
        await this.tonService.sendPayment(
          new Address(payment.recipientAddress),
          toNano(payment.amount.toString())
        );

        successful.push({
          ...payment,
          status: PaymentStatus.COMPLETED,
          processedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Payment failed', {
          payment,
          error,
        });

        failed.push({
          ...payment,
          status: PaymentStatus.FAILED,
          error: error.message,
        });
      }
    }

    return { successful, failed };
  }

  private calculateTotalAmount(payments: PaymentTransaction[]): number {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }
}
