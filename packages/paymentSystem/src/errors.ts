export class PaymentError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'PaymentError';
  }
}

export class TonError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'TonError';
  }
}

export class WalletError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'WalletError';
  }
}

export class TransactionError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'TransactionError';
  }
}

export class BatchProcessingError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'BatchProcessingError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'InsufficientBalanceError';
  }
}

export class GasEstimationError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'GasEstimationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'ValidationError';
  }
}
