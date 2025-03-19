import { WorkflowHandler } from './base';
import { ResultConsolidationOutput, PaymentProcessingOutput } from '../types/workflow';
import { createEnvironmentTransformer } from '@mindburn/shared';
import { SQS } from 'aws-sdk';

interface Config {
  paymentQueueUrl: string;
  basePaymentAmount: number;
  bonusMultipliers: {
    accuracy: number;
    speed: number;
    consensus: number;
  };
}

export class PaymentProcessor extends WorkflowHandler {
  private readonly sqs: SQS;
  private readonly config: Config;

  constructor() {
    super('Tasks');
    this.sqs = new SQS();
    this.config = createEnvironmentTransformer<Config>(process.env);
  }

  async handler(input: ResultConsolidationOutput): Promise<PaymentProcessingOutput> {
    try {
      const { taskId, verificationResults, consensusReached, finalVerdict } = input;

      // Get task details
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Calculate payments for each verifier
      const payments = await Promise.all(
        verificationResults.map(result =>
          this.calculateAndProcessPayment(result, {
            consensusReached,
            finalVerdict,
            taskStartTime: task.verificationStartTime,
          })
        )
      );

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      this.logger.info('Payments processed', {
        taskId,
        paymentCount: payments.length,
        totalPaid,
      });

      return {
        taskId,
        payments,
        totalPaid,
      };
    } catch (error) {
      this.logger.error('Payment processing failed', { error, input });
      throw error;
    }
  }

  private async calculateAndProcessPayment(
    result: any,
    context: {
      consensusReached: boolean;
      finalVerdict: string;
      taskStartTime: string;
    }
  ): Promise<{
    workerId: string;
    amount: number;
    status: 'pending' | 'processed' | 'failed';
  }> {
    const baseAmount = this.config.basePaymentAmount;

    // Calculate bonuses
    const accuracyBonus =
      context.consensusReached && result.verdict === context.finalVerdict
        ? baseAmount * this.config.bonusMultipliers.accuracy
        : 0;

    const responseTime =
      new Date(result.timestamp).getTime() - new Date(context.taskStartTime).getTime();
    const speedBonus =
      responseTime < 300000 // 5 minutes
        ? baseAmount * this.config.bonusMultipliers.speed
        : 0;

    const consensusBonus = context.consensusReached
      ? baseAmount * this.config.bonusMultipliers.consensus
      : 0;

    const totalAmount = baseAmount + accuracyBonus + speedBonus + consensusBonus;

    // Send payment message to queue
    try {
      await this.sqs
        .sendMessage({
          QueueUrl: this.config.paymentQueueUrl,
          MessageBody: JSON.stringify({
            workerId: result.workerId,
            amount: totalAmount,
            breakdown: {
              base: baseAmount,
              accuracyBonus,
              speedBonus,
              consensusBonus,
            },
            timestamp: Date.now(),
          }),
        })
        .promise();

      return {
        workerId: result.workerId,
        amount: totalAmount,
        status: 'processed',
      };
    } catch (error) {
      this.logger.error('Payment queue error', { error, workerId: result.workerId });
      return {
        workerId: result.workerId,
        amount: totalAmount,
        status: 'failed',
      };
    }
  }
}

export const handler = new PaymentProcessor().handler.bind(new PaymentProcessor());
