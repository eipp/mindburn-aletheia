# TypeScript Strict Mode Checking Utilities

This utility module provides functions to enhance TypeScript's strict mode checking and make code more robust when dealing with potential null/undefined values and type assertions.

## Purpose

When working with TypeScript's strict mode, we often need to handle scenarios where:

- Values might be null or undefined
- Type assertions are needed
- Environment variables must be safely accessed
- Object properties need safe access with defaults

This utility provides a consistent, safe approach to these common scenarios with proper error logging.

## Functions

### `assertNonNull<T>(value: T | null | undefined, message?: string): T`

Asserts that a value is not null or undefined, throwing an error if it is.

```typescript
import { assertNonNull } from '@mindburn/shared/src/utils/typeChecking';

// Will throw if config is null/undefined with appropriate error message
const apiKey = assertNonNull(config.apiKey, 'API key is required');
```

### `safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K, defaultValue: T[K]): T[K]`

Safely accesses a potentially undefined property with a default value.

```typescript
import { safeGet } from '@mindburn/shared/src/utils/typeChecking';

// Returns user.name if it exists, or 'Guest' if user is null/undefined or has no name property
const userName = safeGet(user, 'name', 'Guest');
```

### `ensureType<T, R extends T>(value: T, predicate: (value: T) => value is R, typeName: string): R`

Ensures a value is of the expected type, throwing an error if not.

```typescript
import { ensureType, isNonEmptyString } from '@mindburn/shared/src/utils/typeChecking';

// Ensures the value is a non-empty string, throwing a TypeError if not
const validated = ensureType(value, isNonEmptyString, 'non-empty string');
```

### Type Guards

The module provides several useful type guards:

- `isNonEmptyString(value: unknown): value is string` - Checks if a value is a non-empty string
- `isValidNumber(value: unknown): value is number` - Checks if a value is a valid number (not NaN or Infinity)

### Environment Variable Helpers

- `requiredEnv(name: string): string` - Gets a required environment variable, throwing if not set
- `getEnv(name: string, defaultValue: string): string` - Gets an environment variable with a default value

## Usage Guidelines

1. Use these utilities in code that requires strict type checking
2. Prefer these over custom implementations for consistency across the codebase
3. These functions include proper error logging to make debugging easier

## Best Practices

1. Use `assertNonNull` immediately after retrieving values that should never be null
2. Use `safeGet` when accessing potentially undefined properties
3. Use `requiredEnv` for critical environment variables during initialization
4. Use the type guards when validating user input or external data

## Example

```typescript
import { 
  assertNonNull, 
  requiredEnv, 
  safeGet 
} from '@mindburn/shared/src/utils/typeChecking';

function initializeService() {
  // Get required environment variables
  const dbUrl = requiredEnv('DATABASE_URL');
  const region = getEnv('AWS_REGION', 'us-east-1');
  
  // Fetch configuration
  const config = getServiceConfig();
  
  // Assert required configuration
  const apiEndpoint = assertNonNull(config.apiEndpoint, 'API endpoint must be defined');
  
  // Safely access properties with defaults
  const timeout = safeGet(config.settings, 'timeout', 30000);
  
  return {
    dbUrl,
    region,
    apiEndpoint,
    timeout
  };
}
``` 