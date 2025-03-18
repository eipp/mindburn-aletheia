# @mindburn/shared

This package contains shared utilities, types, and services used across the Mindburn Aletheia platform.

## Installation

```bash
yarn add @mindburn/shared
```

## Available Utilities

### TON Utilities

The TON utilities provide a comprehensive set of functions for interacting with the TON blockchain:

```typescript
import { ton, TransactionData, ValidationResult } from '@mindburn/shared';

// Create a new wallet
const wallet = await ton.createWallet();

// Validate a transaction
const result = await ton.validateTransaction(txData);

// Send TON
const txResult = await ton.sendTransaction({
  from: 'EQA...',
  to: 'EQB...',
  amount: '0.1',
});
```

### Verification Service

The verification service provides fraud detection and eligibility checking:

```typescript
import { VerificationService, VerificationOptions } from '@mindburn/shared';

const options: VerificationOptions = {
  minTonBalance: 0.1,
  checkIPRestrictions: true,
  checkAccountAge: true,
  minAccountAgeDays: 7,
  maxVerificationsPerDay: 5,
  maxVerificationsPerIP: 3,
};

const verificationService = new VerificationService(options);

const result = await verificationService.verifyRequest({
  userId: '123456789',
  userIp: '192.168.1.1',
  accountCreatedAt: new Date('2023-01-01'),
  walletAddress: 'EQA...',
});

if (result.success) {
  // Proceed with verification
} else {
  // Handle verification failure
  console.error(result.error);
}
```

### Configuration Utilities

Utilities for managing configuration across environments:

```typescript
import { config } from '@mindburn/shared';

// Get a configuration value
const apiKey = config.get('API_KEY');

// Get a configuration value with a default
const timeout = config.get('TIMEOUT', 30000);

// Check if a feature is enabled
const isFeatureEnabled = config.isEnabled('NEW_FEATURE');
```

### Logging Utilities

Standardized logging across all services:

```typescript
import { logger } from '@mindburn/shared';

logger.info('Operation completed successfully', { userId: '123', operation: 'verification' });
logger.error('Failed to process payment', { error: err, transactionId: 'tx123' });
logger.warn('Rate limit approaching', { currentRate: 95, limit: 100 });
```

## Types

The package exports various types used across the platform:

- `TransactionData`: Type for TON transaction data
- `ValidationResult`: Result of transaction validation
- `VerificationOptions`: Options for the verification service
- `VerificationRequest`: Request data for verification
- `VerificationResult`: Result of verification process
- `PaymentResult`: Result of payment processing

## Contributing

When adding new utilities to this package:

1. Create a new file in the appropriate directory
2. Export the utility from the main `index.ts` file
3. Add tests for the new utility
4. Update this README with documentation for the new utility

For more information on the refactoring process and guidelines, see the [REFACTORING_SUMMARY.md](../../REFACTORING_SUMMARY.md) file.