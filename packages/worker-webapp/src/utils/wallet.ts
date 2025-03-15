import { Address } from 'ton';

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

export const validateWithdrawal = (
  amount: number,
  balance: number,
  minWithdrawal: number = 1
): { isValid: boolean; error?: string } => {
  if (amount <= 0) {
    return { isValid: false, error: 'Amount must be greater than 0' };
  }

  if (amount < minWithdrawal) {
    return { isValid: false, error: `Minimum withdrawal amount is ${minWithdrawal} TON` };
  }

  const fee = calculateFee(amount);
  const totalAmount = amount + fee;

  if (totalAmount > balance) {
    return { isValid: false, error: 'Insufficient balance including fee' };
  }

  return { isValid: true };
};

export const formatTransactionStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed'
  };
  return statusMap[status] || status;
};

export const getTransactionExplorerUrl = (txHash: string, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
  const baseUrl = network === 'mainnet'
    ? 'https://tonscan.org'
    : 'https://testnet.tonscan.org';
  return `${baseUrl}/tx/${txHash}`;
};

export const shortenAddress = (address: string, chars: number = 4): string => {
  if (!address) return '';
  const start = address.slice(0, chars);
  const end = address.slice(-chars);
  return `${start}...${end}`;
};

export const estimateTransactionTime = (network: 'mainnet' | 'testnet' = 'mainnet'): number => {
  // Average block time in seconds
  return network === 'mainnet' ? 5 : 10;
};

export const validateTransactionData = (data: {
  amount: number;
  address: string;
  balance: number;
  minWithdrawal?: number;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate amount
  if (!data.amount || data.amount <= 0) {
    errors.push('Invalid amount');
  }

  // Validate address
  if (!validateTonAddress(data.address)) {
    errors.push('Invalid TON address');
  }

  // Validate balance
  const fee = calculateFee(data.amount);
  const totalAmount = data.amount + fee;
  if (totalAmount > data.balance) {
    errors.push(`Insufficient balance. Total required: ${formatTonAmount(totalAmount)} TON (including fee)`);
  }

  // Validate minimum withdrawal
  if (data.minWithdrawal && data.amount < data.minWithdrawal) {
    errors.push(`Minimum withdrawal amount is ${data.minWithdrawal} TON`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const formatTransactionType = (type: string): string => {
  const typeMap: Record<string, string> = {
    reward: 'Task Reward',
    withdrawal: 'Withdrawal',
    deposit: 'Deposit',
    referral: 'Referral Bonus',
    training: 'Training Reward'
  };
  return typeMap[type] || type;
};

export const getTransactionIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    reward: '🎁',
    withdrawal: '↗️',
    deposit: '↙️',
    referral: '👥',
    training: '📚'
  };
  return iconMap[type] || '💰';
};

export const calculateReward = (
  baseReward: number,
  multipliers: {
    quality?: number;
    speed?: number;
    complexity?: number;
    urgency?: number;
  } = {}
): number => {
  let finalReward = baseReward;

  // Apply quality multiplier (0.5 - 1.5)
  if (multipliers.quality) {
    finalReward *= Math.max(0.5, Math.min(1.5, multipliers.quality));
  }

  // Apply speed multiplier (1.0 - 2.0)
  if (multipliers.speed) {
    finalReward *= Math.max(1.0, Math.min(2.0, multipliers.speed));
  }

  // Apply complexity multiplier (1.0 - 3.0)
  if (multipliers.complexity) {
    finalReward *= Math.max(1.0, Math.min(3.0, multipliers.complexity));
  }

  // Apply urgency multiplier (1.0 - 2.5)
  if (multipliers.urgency) {
    finalReward *= Math.max(1.0, Math.min(2.5, multipliers.urgency));
  }

  // Round to 2 decimal places
  return Math.round(finalReward * 100) / 100;
}; 