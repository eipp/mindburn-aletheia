# Migration Guide: Consolidating Shared Utilities

This guide outlines the changes made to reduce code duplication and standardize common functionality across the Mindburn Aletheia codebase.

## Core Changes

### 1. Shared Types
All common types are now centralized in `@mindburn/shared`:

```typescript
import {
  TaskType,
  TaskStatus,
  BaseTask,
  VerificationTask,
  WorkerTask,
  BaseVerificationResult
} from '@mindburn/shared';
```

#### Migration Steps:
1. Remove local type definitions
2. Import types from `@mindburn/shared`
3. Extend base types for package-specific needs:

```typescript
// Before
interface Task {
  id: string;
  type: string;
  // ... custom fields
}

// After
import { BaseTask } from '@mindburn/shared';

interface CustomTask extends BaseTask {
  // ... only custom fields
}
```

### 2. TON Utilities
Consolidated TON-related utilities into a single namespace:

```typescript
import { ton, BigNumber } from '@mindburn/shared';

// Address validation
const isValid = ton.validation.address(address);

// Amount formatting
const formatted = ton.format.amount(amount);

// Transaction validation
const result = ton.validation.transaction({
  amount,
  address,
  balance,
  minWithdrawal
});

// Fee calculation
const fee = ton.calculation.fee(amount);
```

#### Migration Steps:
1. Remove local TON utility functions
2. Import from `@mindburn/shared`
3. Update function calls to use the new namespace

### 3. Configuration Validation
New type-safe configuration system:

```typescript
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator
} from '@mindburn/shared';

const validateConfig = createConfigValidator({
  schema: MyConfigSchema,
  defaultConfig: myDefaultConfig,
  transformers: [
    createEnvironmentTransformer({
      apiKey: 'MY_API_KEY',
      endpoint: 'MY_ENDPOINT'
    })
  ],
  validators: [
    createSecurityValidator(['apiKey'])
  ]
});
```

#### Migration Steps:
1. Define Zod schema for your config
2. Create config validator using the factory
3. Remove old validation logic
4. Update configuration loading to use the new system

## Directory Structure Changes

### Test Organization
- Consolidated test directories
- Standardized test file naming
- Added shared test utilities

```
/tests
  /unit
  /integration
  /e2e
  /fixtures
  /utils
```

### Package Structure
Updated package organization for better separation of concerns:
```
/packages
  /shared             # Common utilities and types
  /worker-interface   # Combined worker-related functionality
  /verification-engine
  /payment-system
  /developer-platform
```

## Performance Considerations

- Reduced bundle size through code deduplication
- Improved tree-shaking support
- Centralized performance monitoring
- Standardized error handling

## Security Improvements

- Centralized validation logic
- Consistent security checks
- Standardized error handling
- Improved type safety

## Best Practices

1. Always import from `@mindburn/shared` instead of copying utilities
2. Extend base types instead of creating new ones
3. Use the configuration validation system for all configs
4. Follow the test organization structure
5. Contribute common utilities back to the shared package

## Examples

### Configuration Management
```typescript
// config/model-registry.ts
import { z } from 'zod';
import { createConfigValidator } from '@mindburn/shared';

const schema = z.object({
  tableName: z.string(),
  maxItems: z.number().min(1)
});

export const validateConfig = createConfigValidator({
  schema,
  defaultConfig: {
    tableName: 'models',
    maxItems: 1000
  }
});
```

### TON Integration
```typescript
// services/payment.ts
import { ton, BigNumber, PaymentResult } from '@mindburn/shared';

export async function processPayment(
  amount: string,
  address: string
): Promise<PaymentResult> {
  const validation = ton.validation.transaction({
    amount,
    address,
    balance: await getBalance()
  });

  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  const fee = ton.calculation.fee(amount);
  // ... process payment
}
```

### Type Extension
```typescript
// types/verification.ts
import { BaseVerificationResult } from '@mindburn/shared';

export interface CustomVerification extends BaseVerificationResult {
  metadata: {
    device: string;
    location: string;
  };
}
```

## Need Help?

If you encounter any issues during migration:
1. Check the test files for usage examples
2. Review the TypeScript types for proper usage
3. Consult the shared package documentation
4. Open an issue for support

## Contributing

When adding new functionality:
1. Consider if it should be in the shared package
2. Follow the established patterns
3. Add comprehensive tests
4. Update this migration guide 