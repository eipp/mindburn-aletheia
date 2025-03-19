import { tonService } from './ton';
import { PaymentErrors } from '@/contracts/payment';
import { TaskStatus } from '@/types';

interface PaymentResult {
  success: boolean;
  txId?: string;
  error?: string;
}

interface TransactionLog {
  txId: string;
  taskId: string;
  workerAddress: string;
  amount: string;
  timestamp: number;
  status: string;
}

class PaymentService {
  private readonly MIN_REWARD = '0.1'; // Minimum reward in TON
  private readonly MAX_REWARD = '10'; // Maximum reward in TON
  private transactionLogs: TransactionLog[] = [];

  async processReward(
    taskId: string,
    workerAddress: string,
    amount: string
  ): Promise<PaymentResult> {
    try {
      // Validate amount
      if (!this.isValidAmount(amount)) {
        throw new Error(PaymentErrors.InvalidAmount.toString());
      }

      // Get task status from API
      const taskStatus = await this.getTaskStatus(taskId);
      if (taskStatus !== TaskStatus.VERIFIED) {
        throw new Error('Task not verified');
      }

      // Generate signature for the payment
      const signature = await this.generatePaymentSignature(taskId, workerAddress, amount);

      // Send reward
      const tx = await tonService.sendReward({
        workerAddress,
        amount,
        taskId,
        signature,
      });

      // Log transaction
      this.logTransaction({
        txId: tx.txId,
        taskId,
        workerAddress,
        amount,
        timestamp: Date.now(),
        status: tx.status,
      });

      return {
        success: true,
        txId: tx.txId,
      };
    } catch (error) {
      console.error('Error processing reward:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private isValidAmount(amount: string): boolean {
    const value = parseFloat(amount);
    return (
      !isNaN(value) && value >= parseFloat(this.MIN_REWARD) && value <= parseFloat(this.MAX_REWARD)
    );
  }

  private async getTaskStatus(taskId: string): Promise<TaskStatus> {
    // Implement API call to get task status
    return TaskStatus.VERIFIED; // Placeholder
  }

  private async generatePaymentSignature(
    taskId: string,
    workerAddress: string,
    amount: string
  ): Promise<string> {
    // Implement secure signature generation
    // This should use a secure key management service in production
    return 'signature'; // Placeholder
  }

  private logTransaction(log: TransactionLog) {
    this.transactionLogs.push(log);
    // In production, save to persistent storage
  }

  async getTransactionLogs(
    address: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionLog[]> {
    let logs = this.transactionLogs;

    if (address) {
      logs = logs.filter(log => log.workerAddress === address);
    }

    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate.getTime());
    }

    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate.getTime());
    }

    return logs;
  }

  async reconcileTransactions(): Promise<void> {
    const unconfirmedLogs = this.transactionLogs.filter(log => log.status === 'pending');

    for (const log of unconfirmedLogs) {
      try {
        const tx = await tonService.verifyTransaction(log.txId);
        log.status = tx.status;
      } catch (error) {
        console.error('Error reconciling transaction:', error);
      }
    }
  }
}

export const paymentService = new PaymentService();
