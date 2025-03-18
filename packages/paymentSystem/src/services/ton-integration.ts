import { KMS } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { TonClient, Address, toNano, fromNano, Cell, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey, mnemonicToPrivateKey } from '@ton/ton';
import { PaymentBatchModel, PaymentBatch } from '../models/payment-batch';
import { Logger } from '@mindburn/shared/logger';
import { retry } from '@mindburn/shared/utils';
import { TonError } from '../errors';
import { 
  TransactionStatus, 
  WalletConfig,
  TransactionReceipt,
  GasEstimate
} from '../types';

const logger = createLogger('TONIntegrationService');

interface TONPayment {
  destinationAddress: string;
  amount: number;
  message?: string;
  referenceId?: string;
}

interface TONBatchPayment {
  payments: {
    destinationAddress: string;
    amount: number;
    referenceId?: string;
  }[];
}

export class TONIntegrationService {
  private client: TonClient;
  private kms: KMS;
  private wallet: WalletContractV4 | null = null;
  private batchModel: PaymentBatchModel;
  private readonly maxRetries = 3;
  private readonly minGasBuffer = 0.1; // 10% buffer for gas estimates

  constructor(
    endpoint: string,
    private readonly config: WalletConfig,
    logger: Logger
  ) {
    this.kms = new KMS();
    this.client = new TonClient({ endpoint });
    this.batchModel = new PaymentBatchModel();
    this.logger = logger.child({ service: 'TonIntegration' });
  }

  async initialize(): Promise<void> {
    try {
      const keyPair = await mnemonicToPrivateKey(this.config.mnemonic.split(' '));
      this.wallet = WalletContractV4.create({ 
        publicKey: keyPair.publicKey,
        workchain: 0 
      });
      
      // Verify wallet is deployed and has sufficient balance
      await this.verifyWalletStatus();
    } catch (error) {
      this.logger.error('Failed to initialize TON wallet', { error });
      throw new TonError('Wallet initialization failed', { cause: error });
    }
  }

  async sendPayment(
    recipient: Address,
    amount: bigint,
    payload?: Cell
  ): Promise<TransactionReceipt> {
    if (!this.wallet) {
      throw new TonError('Wallet not initialized');
    }

    try {
      // Estimate gas and verify sufficient balance
      const gasEstimate = await this.estimateGas(recipient, amount, payload);
      await this.verifyBalance(amount + gasEstimate.total);

      // Send transaction with retry
      const seqno = await retry(
        () => this.wallet!.sendTransfer({
          secretKey: await mnemonicToPrivateKey(this.config.mnemonic.split(' ')),
          messages: [{
            amount,
            destination: recipient,
            payload
          }],
          seqno: await this.wallet!.getSeqno(),
          sendMode: 3,
        }),
        {
          maxRetries: this.maxRetries,
          backoff: 'exponential',
          logger: this.logger
        }
      );

      // Wait for transaction confirmation
      const receipt = await this.waitForConfirmation(seqno);
      
      this.logger.info('Payment sent successfully', {
        recipient: recipient.toString(),
        amount: fromNano(amount),
        txHash: receipt.transactionHash
      });

      return receipt;
    } catch (error) {
      this.logger.error('Payment failed', {
        recipient: recipient.toString(),
        amount: fromNano(amount),
        error
      });
      throw new TonError('Payment failed', { cause: error });
    }
  }

  async sendTONPayment(payment: TONPayment) {
    try {
      logger.info('Sending TON payment', { payment });

      // Initialize wallet if not done
      await this.initialize();

      // Validate address
      const validation = await this.validateTONAddress({ address: payment.destinationAddress });
      if (!validation.valid) {
        throw new Error('Invalid destination address');
      }

      // Check wallet balance
      const balance = await this.getBalance();
      if (balance < payment.amount) {
        throw new Error('Insufficient wallet balance');
      }

      // Send transaction
      const seqno = await this.wallet!.getSeqno();
      const destinationAddress = Address.parse(payment.destinationAddress);
      
      await this.wallet!.sendTransfer({
        secretKey: await this.getWalletKey(),
        seqno: seqno,
        messages: [{
          amount: toNano(payment.amount.toString()),
          destination: destinationAddress,
          payload: payment.message ? payment.message : undefined
        }]
      });

      // Wait for transaction to be included in a block
      const transaction = await this.waitForTransaction(seqno);

      return {
        transactionId: transaction.hash,
        amount: payment.amount,
        fee: fromNano(transaction.fee),
        destinationAddress: payment.destinationAddress,
        status: 'confirmed',
        transactionHash: transaction.hash,
        blockId: transaction.block,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send TON payment', { error, payment });
      throw error;
    }
  }

  async createPaymentBatch(batch: TONBatchPayment) {
    try {
      logger.info('Creating payment batch', { batch });

      // Calculate totals
      const totalAmount = batch.payments.reduce((sum, p) => sum + p.amount, 0);
      const estimatedFee = await this.estimateBatchFee(batch.payments.length);

      // Check wallet balance
      const balance = await this.getBalance();
      if (balance < (totalAmount + estimatedFee)) {
        throw new Error('Insufficient wallet balance for batch');
      }

      const batchId = await this.createBatch(batch);

      return {
        batchId,
        totalAmount,
        totalFee: estimatedFee,
        paymentCount: batch.payments.length,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to create payment batch', { error, batch });
      throw error;
    }
  }

  async processPaymentBatch(params: { batchId: string }) {
    try {
      logger.info('Processing payment batch', { batchId: params.batchId });

      const batch = await this.getBatch(params.batchId);
      if (!batch) {
        throw new Error('Batch not found');
      }

      if (batch.status !== 'pending') {
        throw new Error('Batch already processed');
      }

      // Initialize wallet
      await this.initialize();

      const results = {
        successful: 0,
        failed: 0,
        transactions: [] as any[]
      };

      // Process payments in chunks
      for (let i = 0; i < batch.payments.length; i += 4) { // Max 4 messages per transaction
        const chunk = batch.payments.slice(i, i + 4);
        const seqno = await this.wallet!.getSeqno();

        try {
          await this.wallet!.sendTransfer({
            secretKey: await this.getWalletKey(),
            seqno: seqno,
            messages: chunk.map(payment => ({
              amount: toNano(payment.amount.toString()),
              destination: Address.parse(payment.destinationAddress),
              payload: payment.referenceId
            }))
          });

          const transaction = await this.waitForTransaction(seqno);

          results.successful += chunk.length;
          results.transactions.push(...chunk.map(payment => ({
            referenceId: payment.referenceId,
            destinationAddress: payment.destinationAddress,
            amount: payment.amount,
            status: 'confirmed',
            transactionHash: transaction.hash
          })));
        } catch (error) {
          logger.error('Failed to process batch chunk', { error, chunk });
          results.failed += chunk.length;
          results.transactions.push(...chunk.map(payment => ({
            referenceId: payment.referenceId,
            destinationAddress: payment.destinationAddress,
            amount: payment.amount,
            status: 'failed'
          })));
        }
      }

      await this.updateBatchStatus(params.batchId, results.failed === 0 ? 'completed' : 'partial_failure', results);

      return {
        batchId: params.batchId,
        status: results.failed === 0 ? 'completed' : 'partial_failure',
        results,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to process payment batch', { error, batchId: params.batchId });
      throw error;
    }
  }

  async checkTransactionStatus(transactionHash: string) {
    try {
      const transaction = await this.client.getTransaction(transactionHash);
      
      return {
        transactionHash,
        status: transaction.status,
        confirmations: transaction.confirmations,
        blockId: transaction.block,
        timestamp: transaction.time,
        fee: fromNano(transaction.fee)
      };
    } catch (error) {
      logger.error('Failed to check transaction status', { error, transactionHash });
      throw error;
    }
  }

  async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new TonError('Wallet not initialized');
    }
    const balance = await this.wallet.getBalance();
    return fromNano(balance);
  }

  async validateTONAddress(params: { address: string }) {
    try {
      const address = Address.parse(params.address);
      return {
        valid: true,
        formatted: address.toString(),
        rawAddress: address.toRawString(),
        bounceable: address.isBounceable
      };
    } catch {
      return { valid: false };
    }
  }

  private async verifyWalletStatus(): Promise<void> {
    if (!this.wallet) {
      throw new TonError('Wallet not initialized');
    }

    const isDeployed = await this.wallet.isDeployed();
    if (!isDeployed) {
      throw new TonError('Wallet not deployed');
    }

    const balance = await this.wallet.getBalance();
    if (balance < toNano('1')) {
      throw new TonError('Insufficient wallet balance');
    }
  }

  private async verifyBalance(requiredAmount: bigint): Promise<void> {
    if (!this.wallet) {
      throw new TonError('Wallet not initialized');
    }

    const balance = await this.wallet.getBalance();
    if (balance < requiredAmount) {
      throw new TonError('Insufficient balance for transaction');
    }
  }

  private async estimateGas(
    recipient: Address,
    amount: bigint,
    payload?: Cell
  ): Promise<GasEstimate> {
    try {
      const estimate = await this.client.estimateFee({
        to: recipient,
        value: amount,
        payload
      });

      const total = estimate.source_fees.in_fwd_fee +
                    estimate.source_fees.storage_fee +
                    estimate.source_fees.gas_fee +
                    estimate.source_fees.fwd_fee;
      
      // Add safety buffer
      const withBuffer = total + (total * BigInt(Math.floor(this.minGasBuffer * 100)) / BigInt(100));

      return {
        total: withBuffer,
        breakdown: {
          forward: estimate.source_fees.fwd_fee,
          storage: estimate.source_fees.storage_fee,
          gas: estimate.source_fees.gas_fee,
          inForward: estimate.source_fees.in_fwd_fee
        }
      };
    } catch (error) {
      throw new TonError('Failed to estimate gas', { cause: error });
    }
  }

  private async waitForConfirmation(seqno: number): Promise<TransactionReceipt> {
    if (!this.wallet) {
      throw new TonError('Wallet not initialized');
    }

    try {
      // Wait for transaction to be included in a block
      await retry(
        async () => {
          const currentSeqno = await this.wallet!.getSeqno();
          if (currentSeqno !== seqno + 1) {
            throw new Error('Transaction not confirmed');
          }
        },
        {
          maxRetries: this.maxRetries,
          backoff: 'exponential',
          logger: this.logger
        }
      );

      // Get transaction details
      const transactions = await this.wallet.getTransactions(1);
      const tx = transactions[0];

      return {
        transactionHash: tx.hash().toString('hex'),
        blockNumber: tx.blockNumber,
        status: TransactionStatus.CONFIRMED,
        gasUsed: tx.totalFees.coins,
        timestamp: new Date(tx.time * 1000).toISOString()
      };
    } catch (error) {
      throw new TonError('Failed to confirm transaction', { cause: error });
    }
  }

  private async waitForTransaction(seqno: number): Promise<any> {
    let attempts = 0;
    while (attempts < 10) {
      try {
        if (await this.wallet!.getSeqno() > seqno) {
          // Get the last transaction
          const transactions = await this.wallet!.getTransactions();
          return transactions[0];
        }
      } catch (error) {
        logger.warn('Error waiting for transaction', { error, seqno });
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }
    throw new Error('Transaction confirmation timeout');
  }

  private async estimateBatchFee(paymentCount: number) {
    // Estimate based on current network conditions and number of payments
    const baseFee = 0.1; // 0.1 TON
    const perPaymentFee = 0.05; // 0.05 TON
    return baseFee + (perPaymentFee * paymentCount);
  }

  private async createBatch(batch: TONBatchPayment): Promise<string> {
    const batchId = crypto.randomUUID();
    
    await this.batchModel.create({
      batchId,
      payments: batch.payments.map(p => ({
        destinationAddress: p.destinationAddress,
        amount: p.amount,
        referenceId: p.referenceId
      })),
      totalAmount: batch.payments.reduce((sum, p) => sum + p.amount, 0),
      estimatedFee: await this.estimateBatchFee(batch.payments.length),
      status: 'pending'
    });

    return batchId;
  }

  private async getBatch(batchId: string): Promise<PaymentBatch | null> {
    return this.batchModel.get(batchId);
  }

  private async updateBatchStatus(
    batchId: string, 
    status: PaymentBatch['status'], 
    results?: PaymentBatch['results']
  ): Promise<void> {
    const updates: Partial<PaymentBatch> = { status };
    
    if (results) {
      updates.results = results;
    }
    
    if (status === 'completed' || status === 'partial_failure' || status === 'failed') {
      updates.processedAt = new Date().toISOString();
    }

    await this.batchModel.update(batchId, updates);
  }

  private async listPendingBatches(): Promise<PaymentBatch[]> {
    return this.batchModel.listPending();
  }

  private async getWalletMnemonic(): Promise<string> {
    const result = await this.kms.decrypt({
      CiphertextBlob: Buffer.from(process.env.ENCRYPTED_WALLET_MNEMONIC!, 'base64'),
      KeyId: process.env.KMS_KEY_ID!
    }).promise();

    return result.Plaintext!.toString();
  }

  private async getWalletKey() {
    const mnemonic = await this.getWalletMnemonic();
    const key = await mnemonicToWalletKey(mnemonic.split(' '));
    return key.secretKey;
  }
} 