# Naming Convention Guide

This guide establishes standardized naming conventions for the Mindburn Aletheia codebase to improve consistency, readability, and maintainability.

## File Naming Conventions

| File Type | Convention | Example |
|-----------|------------|---------|
| Regular TypeScript/JavaScript files | camelCase | `userService.ts`, `apiClient.js` |
| React Components | PascalCase | `UserProfile.tsx`, `PaymentForm.jsx` |
| Test files | camelCase with `.test` or `.spec` suffix | `userService.test.ts`, `apiClient.spec.js` |
| Configuration files | camelCase with `.config` suffix | `webpack.config.js`, `jest.config.js` |
| Type definition files | camelCase with `.types` suffix | `user.types.ts`, `payment.types.ts` |
| Directory names | kebab-case | `user-profiles/`, `payment-system/` |

## Code Naming Conventions

### Variables and Functions

```typescript
// Variables - camelCase
const userId = '123';
const paymentAmount = 100;

// Functions - camelCase
function getUserById(id: string) { ... }
function processPayment(amount: number) { ... }

// Boolean variables - prefixed with 'is', 'has', 'should', etc.
const isActive = true;
const hasPermission = checkPermission();
const shouldRefresh = lastUpdate < threshold;
```

### Classes and Interfaces

```typescript
// Classes - PascalCase
class UserService { ... }
class PaymentProcessor { ... }

// Interfaces - PascalCase with 'I' prefix (optional)
interface User { ... }
interface IPaymentMethod { ... }  // 'I' prefix is optional but should be consistent

// Type aliases - PascalCase
type PaymentStatus = 'pending' | 'completed' | 'failed';
type UserRole = 'admin' | 'user' | 'guest';
```

### Constants

```typescript
// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// Enum values - UPPER_SNAKE_CASE
enum PaymentType {
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTOCURRENCY = 'cryptocurrency'
}
```

### React Components

```typescript
// Component files - PascalCase
// UserProfile.tsx

// Component names - PascalCase
function UserProfile(props: UserProfileProps) { ... }

// Component props interfaces - PascalCase with 'Props' suffix
interface UserProfileProps { ... }

// Component state interfaces - PascalCase with 'State' suffix
interface UserProfileState { ... }
```

### CSS/SCSS Files and Classes

```scss
// CSS/SCSS files - kebab-case
// user-profile.scss

// CSS classes - kebab-case
.user-profile { ... }
.payment-form { ... }

// BEM methodology (optional but recommended)
.user-profile { ... }
.user-profile__avatar { ... }
.user-profile--active { ... }
```

## Import Order

Organize imports in the following order:

1. External libraries
2. Internal modules
3. Relative imports
4. Type imports

```typescript
// External libraries
import React, { useState, useEffect } from 'react';
import { Container, Button } from 'some-ui-library';

// Internal modules
import { logger } from '@mindburn/shared';
import { PaymentService } from '@mindburn/payment-system';

// Relative imports
import { validatePayment } from './utils';
import { PaymentForm } from './components';

// Type imports
import type { Payment, PaymentMethod } from './types';
```

## File Structure

### TypeScript/JavaScript Files

```typescript
// 1. Imports
import { ... } from '...';

// 2. Type definitions (if not in separate file)
interface User { ... }

// 3. Constants
const MAX_USERS = 100;

// 4. Helper functions
function formatName(user: User) { ... }

// 5. Main function/component/class
export function UserList() { ... }

// 6. Default export (if needed)
export default UserList;
```

### React Component Files

```typescript
// 1. Imports
import React from 'react';

// 2. Type definitions
interface UserProfileProps { ... }

// 3. Constants
const DEFAULT_AVATAR = '/images/default-avatar.png';

// 4. Helper functions
function formatUserName(user) { ... }

// 5. Component
function UserProfile(props: UserProfileProps) { ... }

// 6. Default export
export default UserProfile;
```

## Enforcement

These naming conventions will be enforced through:

1. ESLint rules
2. Code review process
3. Automated scripts for renaming existing files

## Migration

To migrate existing code to these conventions:

1. Run the renaming script with dry-run mode:
   ```
   node scripts/refactoring/rename-files.js --dry-run
   ```

2. Review the proposed changes

3. Apply the changes:
   ```
   node scripts/refactoring/rename-files.js --update-imports
   ```

4. Update any broken imports manually if needed

## Exceptions

Some exceptions to these rules may be necessary:

1. Files that must match specific framework conventions
2. Generated code
3. Third-party code

In these cases, document the exception in the file or in a README.md file in the directory. 