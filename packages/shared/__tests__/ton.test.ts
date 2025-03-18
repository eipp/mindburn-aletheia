import { ton, BigNumber } from '../src';

describe('TON Utilities', () => {
  describe('address validation', () => {
    it('should validate correct TON addresses', () => {
      expect(ton.validation.address('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI')).toBe(true);
    });

    it('should reject invalid TON addresses', () => {
      expect(ton.validation.address('invalid-address')).toBe(false);
      expect(ton.validation.address('')).toBe(false);
    });
  });

  describe('amount formatting', () => {
    it('should format TON amounts correctly', () => {
      expect(ton.format.amount(1.23456789)).toBe('1.234567890 TON');
      expect(ton.format.amount('5')).toBe('5.000000000 TON');
      expect(ton.format.amount(new BigNumber('10.1'))).toBe('10.100000000 TON');
    });
  });

  describe('amount parsing', () => {
    it('should parse valid TON amounts', () => {
      expect(ton.parse.amount('1.23 TON')?.toString()).toBe('1.23');
      expect(ton.parse.amount('5')?.toString()).toBe('5');
    });

    it('should handle invalid amounts', () => {
      expect(ton.parse.amount('invalid')).toBeNull();
      expect(ton.parse.amount('')).toBeNull();
    });
  });

  describe('transaction validation', () => {
    const validData = {
      amount: '1.5',
      address: 'EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI',
      balance: '2.0',
      minWithdrawal: 1,
    };

    it('should validate valid transaction data', () => {
      const result = ton.validation.transaction(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject transactions with insufficient balance', () => {
      const result = ton.validation.transaction({
        ...validData,
        balance: '1.0',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Insufficient balance');
    });

    it('should reject transactions below minimum withdrawal', () => {
      const result = ton.validation.transaction({
        ...validData,
        amount: '0.5',
        minWithdrawal: 1,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Minimum withdrawal');
    });

    it('should reject invalid addresses', () => {
      const result = ton.validation.transaction({
        ...validData,
        address: 'invalid-address',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid TON address');
    });
  });

  describe('fee calculation', () => {
    it('should calculate fees correctly', () => {
      const amount = new BigNumber('10');
      const fee = ton.calculation.fee(amount);
      expect(fee.toString()).toBe('0.02'); // 0.1% + 0.01 base fee
    });

    it('should handle string amounts', () => {
      const fee = ton.calculation.fee('5.5');
      expect(fee.toString()).toBe('0.0155');
    });

    it('should handle zero amount', () => {
      const fee = ton.calculation.fee(0);
      expect(fee.toString()).toBe('0.01'); // Only base fee
    });
  });
});
