import { PaymentService, PaymentServiceConfig } from '@/packages/paymentSystem/src/services/payment';
import { TonWalletConnector } from '@mindburn/tonContracts';
import * as AWS from 'aws-sdk-mock';
import * as AWS_SDK from 'aws-sdk';
import { BigNumber } from '@mindburn/shared';

// Mock dependencies
jest.mock('@mindburn/shared', () => {
  const originalModule = jest.requireActual('@mindburn/shared');
  return {
    ...originalModule,
    ton: {
      client: {
        create: jest.fn().mockReturnValue({
          getBalance: jest.fn(),
        }),
        getBalance: jest.fn().mockResolvedValue('1000000000'),
      },
      validation: {
        transaction: jest.fn().mockImplementation((data) => {
          if (data.amount <= 0 || !data.recipientAddress) {
            return { isValid: false, errors: ['Invalid amount or recipient'] };
          }
          return { isValid: true, errors: [] };
        }),
        address: jest.fn().mockImplementation((address) => {
          return address && address.startsWith('EQ');
        }),
        withdrawal: jest
          .fn()
          .mockImplementation((amount, balance) => {
            const numAmount = new BigNumber(amount);
            const numBalance = new BigNumber(balance);
            return {
              isValid: numAmount.lte(numBalance),
              errors: numAmount.lte(numBalance) ? [] : ['Insufficient balance'],
            };
          }),
      },
      calculation: {
        fee: jest.fn().mockImplementation((amount) => {
          return new BigNumber(amount).multipliedBy(0.01).toString();
        }),
      },
      explorer: {
        getTransactionUrl: jest.fn().mockImplementation((txId, network) => {
          return `https://${network === 'testnet' ? 'testnet.' : ''}tonscan.org/tx/${txId}`;
        }),
      },
    },
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
    BigNumber: originalModule.BigNumber || class BigNumber {
      constructor(value) {
        this.value = value;
      }
      toString() {
        return this.value.toString();
      }
      plus(other) {
        return new BigNumber(parseFloat(this.value) + parseFloat(other));
      }
      multipliedBy(factor) {
        return new BigNumber(parseFloat(this.value) * factor);
      }
      lte(other) {
        return parseFloat(this.value) <= parseFloat(other.value || other);
      }
    },
  };
});

jest.mock('@mindburn/tonContracts', () => {
  return {
    TonWalletConnector: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue('ton://transfer/EQD-Psd...'),
      createTask: jest.fn().mockResolvedValue({ boc: 'tx-batch-hash' }),
      verifyTask: jest.fn().mockResolvedValue({ boc: 'tx-verify-hash' }),
      isConnected: jest.fn().mockReturnValue(true),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getAddress: jest.fn().mockReturnValue('EQD-Psd...'),
    })),
  };
});

describe('PaymentService', () => {
  let paymentService: PaymentService;
  const mockSendMessage = jest.fn().mockResolvedValue({ MessageId: '12345' });
  const mockReceiveMessage = jest.fn();
  const mockDeleteMessage = jest.fn().mockResolvedValue({});

  beforeAll(() => {
    AWS.mock('SQS', 'sendMessage', mockSendMessage);
    AWS.mock('SQS', 'receiveMessage', mockReceiveMessage);
    AWS.mock('SQS', 'deleteMessage', mockDeleteMessage);
  });

  afterAll(() => {
    AWS.restore('SQS');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    const config: PaymentServiceConfig = {
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: 'test-api-key',
      network: 'testnet',
      contractAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
      manifestUrl: 'https://example.com/tonconnect-manifest.json',
      batchSize: 5,
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-queue',
    };
    
    paymentService = new PaymentService(config);
  });

  describe('processPayment', () => {
    it('should validate and queue a payment', async () => {
      const data = {
        amount: '10',
        recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
        memo: 'Payment for verification',
      };

      const result = await paymentService.processPayment(data);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.txId).toContain('queued-');
      
      // Verify SQS message was sent
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        MessageBody: expect.stringContaining('process_payment'),
      }));
    });

    it('should return error for invalid payment data', async () => {
      const data = {
        amount: '-5', // Invalid amount
        recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
      };

      const result = await paymentService.processPayment(data);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
    
    it('should handle SQS errors when queueing payments', async () => {
      // Setup SQS to throw error
      AWS.remock('SQS', 'sendMessage', jest.fn().mockRejectedValue(new Error('SQS error')));
      
      const data = {
        amount: '10',
        recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
      };

      const result = await paymentService.processPayment(data);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('SQS error');
      expect(result.status).toBe('failed');
    });
  });

  describe('processBatch', () => {
    it('should process batch payments from the queue', async () => {
      // Mock SQS receive message response
      mockReceiveMessage.mockResolvedValueOnce({
        Messages: [
          {
            MessageId: 'msg1',
            ReceiptHandle: 'receipt1',
            Body: JSON.stringify({
              action: 'process_payment',
              payload: {
                amount: '5',
                recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
              },
              timestamp: Date.now(),
            }),
          },
          {
            MessageId: 'msg2',
            ReceiptHandle: 'receipt2',
            Body: JSON.stringify({
              action: 'process_payment',
              payload: {
                amount: '10',
                recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
              },
              timestamp: Date.now(),
            }),
          },
        ],
      });

      // Initialize the wallet connector
      await paymentService.initWallet();
      
      const result = await paymentService.processBatch();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.txId).toBe('tx-batch-hash');
      
      // Verify TonWalletConnector was called
      expect(TonWalletConnector.prototype.createTask).toHaveBeenCalledWith(
        expect.any(String),
        '15' // 5 + 10
      );
      
      // Verify messages were deleted from queue
      expect(mockDeleteMessage).toHaveBeenCalledTimes(2);
    });
    
    it('should return success when queue is empty', async () => {
      // Mock empty queue
      mockReceiveMessage.mockResolvedValueOnce({
        Messages: [],
      });

      const result = await paymentService.processBatch();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.txId).toBeUndefined();
      expect(TonWalletConnector.prototype.createTask).not.toHaveBeenCalled();
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });
    
    it('should initialize wallet when not connected', async () => {
      // Mock wallet not connected
      TonWalletConnector.prototype.isConnected = jest.fn().mockReturnValueOnce(false);
      
      // Mock SQS message
      mockReceiveMessage.mockResolvedValueOnce({
        Messages: [
          {
            MessageId: 'msg1',
            ReceiptHandle: 'receipt1',
            Body: JSON.stringify({
              action: 'process_payment',
              payload: {
                amount: '5',
                recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
              },
              timestamp: Date.now(),
            }),
          },
        ],
      });
      
      const result = await paymentService.processBatch();

      expect(result.success).toBe(true);
      expect(TonWalletConnector.prototype.connect).toHaveBeenCalled();
    });
    
    it('should handle errors in batch processing', async () => {
      // Mock SQS receive message response
      mockReceiveMessage.mockResolvedValueOnce({
        Messages: [
          {
            MessageId: 'msg1',
            ReceiptHandle: 'receipt1',
            Body: JSON.stringify({
              action: 'process_payment',
              payload: {
                amount: '5',
                recipientAddress: 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx',
              },
              timestamp: Date.now(),
            }),
          },
        ],
      });
      
      // Make createTask throw an error
      TonWalletConnector.prototype.createTask = jest.fn().mockRejectedValueOnce(
        new Error('Contract interaction failed')
      );

      const result = await paymentService.processBatch();

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Contract interaction failed');
      
      // Messages should not be deleted when there's an error
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('verifyTaskCompletion', () => {
    it('should verify task completion through the contract', async () => {
      const taskId = 'task-123';
      const success = true;

      // Initialize the wallet connector
      await paymentService.initWallet();
      
      const result = await paymentService.verifyTaskCompletion(taskId, success);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.txId).toBe('tx-verify-hash');
      
      // Verify TonWalletConnector was called
      expect(TonWalletConnector.prototype.verifyTask).toHaveBeenCalledWith(
        taskId,
        success
      );
    });
    
    it('should handle errors in verification', async () => {
      const taskId = 'task-error';
      const success = false;
      
      // Make verifyTask throw an error
      TonWalletConnector.prototype.verifyTask = jest.fn().mockRejectedValueOnce(
        new Error('Verification failed')
      );

      const result = await paymentService.verifyTaskCompletion(taskId, success);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification failed');
    });
  });

  describe('getBalance', () => {
    it('should return balance for valid address', async () => {
      const address = 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx';
      
      // Setup mock balance
      const ton = require('@mindburn/shared').ton;
      ton.client.getBalance.mockResolvedValueOnce('5000000000');
      
      const balance = await paymentService.getBalance(address);
      
      expect(balance).toBeDefined();
      expect(balance.toString()).toBe('5000000000');
    });
    
    it('should throw error for invalid address', async () => {
      const address = 'invalid-address';
      
      await expect(paymentService.getBalance(address)).rejects.toThrow('Invalid TON address');
    });
  });

  describe('validateWithdrawal', () => {
    it('should validate withdrawal when balance is sufficient', async () => {
      const address = 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx';
      const amount = '500000000'; // Less than the mocked balance of 1000000000
      
      const result = await paymentService.validateWithdrawal(amount, address);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should invalidate withdrawal when balance is insufficient', async () => {
      const address = 'EQD-PsdvJmKj4O2EGPUZJKn6g-OKZJ4-J5v1MXNYyHstIDBx';
      const amount = '2000000000'; // More than the mocked balance of 1000000000
      
      const result = await paymentService.validateWithdrawal(amount, address);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient balance');
    });
  });

  describe('getTransactionUrl', () => {
    it('should return correct mainnet transaction URL', () => {
      const txId = 'abc123';
      
      const url = paymentService.getTransactionUrl(txId, 'mainnet');
      
      expect(url).toBe('https://tonscan.org/tx/abc123');
    });
    
    it('should return correct testnet transaction URL', () => {
      const txId = 'abc123';
      
      const url = paymentService.getTransactionUrl(txId, 'testnet');
      
      expect(url).toBe('https://testnet.tonscan.org/tx/abc123');
    });
    
    it('should use default network from service if not specified', () => {
      const txId = 'abc123';
      
      const url = paymentService.getTransactionUrl(txId);
      
      // Using 'testnet' from our config
      expect(url).toBe('https://testnet.tonscan.org/tx/abc123');
    });
  });
}); 