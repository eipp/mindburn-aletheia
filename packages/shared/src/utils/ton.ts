import { Address } from '@ton/core';

export const validateTonAddress = (address: string): boolean => {
  try {
    new Address(address);
    return true;
  } catch {
    return false;
  }
};

export const formatTonAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseTonAmount = (amount: string): number | null => {
  try {
    const cleanAmount = amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanAmount);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};

export const calculateFee = (amount: number): number => {
  // TON transfer fee is typically 0.01 TON
  return 0.01;
};

export const getTransactionExplorerUrl = (txHash: string, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
  const baseUrl = network === 'mainnet'
    ? 'https://tonscan.org'
    : 'https://testnet.tonscan.org';
  return `${baseUrl}/tx/${txHash}`;
};

export const validateTransactionData = (data: {
  amount: number;
  address: string;
  balance: number;
  minWithdrawal?: number;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.amount || data.amount <= 0) {
    errors.push('Invalid amount');
  }

  if (!validateTonAddress(data.address)) {
    errors.push('Invalid TON address');
  }

  const fee = calculateFee(data.amount);
  const totalAmount = data.amount + fee;
  if (totalAmount > data.balance) {
    errors.push(`Insufficient balance. Total required: ${formatTonAmount(totalAmount)} TON (including fee)`);
  }

  if (data.minWithdrawal && data.amount < data.minWithdrawal) {
    errors.push(`Minimum withdrawal amount is ${data.minWithdrawal} TON`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}; 