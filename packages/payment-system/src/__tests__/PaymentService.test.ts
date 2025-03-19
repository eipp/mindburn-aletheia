import { PaymentService } from '../PaymentService';
import { createTonService } from '@mindburn/shared';
import { mock } from 'jest-mock-extended';

jest.mock('@mindburn/shared', () => ({
  createTonService: jest.fn(),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockTonService: any;

  beforeEach(() => {
    mockTonService = mock({
      sendPayment: jest.fn(),
      getBalance: jest.fn(),
      validateAddress: jest.fn(),
    });
    (createTonService as jest.Mock).mockReturnValue(mockTonService);
    paymentService = new PaymentService({
      environment: 'test',
      batchSize: 100,
      minPaymentAmount: 0.1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should successfully process a valid payment', async () => {
      const payment = {
        id: '123',
        amount: 1.0,
        recipientAddress: 'EQA...xyz',
        metadata: { taskId: '456' },
      };

      mockTonService.validateAddress.mockResolvedValue(true);
      mockTonService.sendPayment.mockResolvedValue({
        transactionId: 'tx123',
        status: 'success',
      });

      const result = await paymentService.processPayment(payment);

      expect(result).toEqual({
        success: true,
        transactionId: 'tx123',
        paymentId: '123',
      });
      expect(mockTonService.validateAddress).toHaveBeenCalledWith(payment.recipientAddress);
      expect(mockTonService.sendPayment).toHaveBeenCalledWith(
        payment.recipientAddress,
        payment.amount,
        expect.any(Object)
      );
    });

    it('should reject payment with invalid amount', async () => {
      const payment = {
        id: '123',
        amount: 0.05, // Below minimum
        recipientAddress: 'EQA...xyz',
        metadata: { taskId: '456' },
      };

      await expect(paymentService.processPayment(payment)).rejects.toThrow(
        'Payment amount below minimum'
      );
      expect(mockTonService.sendPayment).not.toHaveBeenCalled();
    });

    it('should reject payment with invalid address', async () => {
      const payment = {
        id: '123',
        amount: 1.0,
        recipientAddress: 'invalid',
        metadata: { taskId: '456' },
      };

      mockTonService.validateAddress.mockResolvedValue(false);

      await expect(paymentService.processPayment(payment)).rejects.toThrow(
        'Invalid recipient address'
      );
      expect(mockTonService.sendPayment).not.toHaveBeenCalled();
    });

    it('should handle TON service errors gracefully', async () => {
      const payment = {
        id: '123',
        amount: 1.0,
        recipientAddress: 'EQA...xyz',
        metadata: { taskId: '456' },
      };

      mockTonService.validateAddress.mockResolvedValue(true);
      mockTonService.sendPayment.mockRejectedValue(new Error('Network error'));

      await expect(paymentService.processPayment(payment)).rejects.toThrow('Network error');
    });
  });

  describe('processBatch', () => {
    it('should process multiple payments in batch', async () => {
      const payments = [
        {
          id: '1',
          amount: 1.0,
          recipientAddress: 'EQA...1',
          metadata: { taskId: '1' },
        },
        {
          id: '2',
          amount: 2.0,
          recipientAddress: 'EQA...2',
          metadata: { taskId: '2' },
        },
      ];

      mockTonService.validateAddress.mockResolvedValue(true);
      mockTonService.sendPayment.mockResolvedValue({
        transactionId: 'batch123',
        status: 'success',
      });

      const results = await paymentService.processBatch(payments);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockTonService.sendPayment).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failures', async () => {
      const payments = [
        {
          id: '1',
          amount: 1.0,
          recipientAddress: 'EQA...1',
          metadata: { taskId: '1' },
        },
        {
          id: '2',
          amount: 0.05, // Invalid amount
          recipientAddress: 'EQA...2',
          metadata: { taskId: '2' },
        },
      ];

      mockTonService.validateAddress.mockResolvedValue(true);
      mockTonService.sendPayment.mockResolvedValue({
        transactionId: 'batch123',
        status: 'success',
      });

      const results = await paymentService.processBatch(payments);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(mockTonService.sendPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPaymentStats', () => {
    it('should return correct payment statistics', async () => {
      const successfulPayment = {
        id: '1',
        amount: 1.0,
        status: 'success',
        timestamp: new Date(),
      };
      const failedPayment = {
        id: '2',
        amount: 2.0,
        status: 'failed',
        timestamp: new Date(),
      };

      // Mock internal stats tracking
      (paymentService as any).paymentStats = {
        totalProcessed: 2,
        successfulPayments: [successfulPayment],
        failedPayments: [failedPayment],
      };

      const stats = await paymentService.getPaymentStats();

      expect(stats).toEqual({
        totalProcessed: 2,
        successRate: 50,
        totalAmount: 3.0,
        successfulAmount: 1.0,
        failedAmount: 2.0,
      });
    });
  });
}); 