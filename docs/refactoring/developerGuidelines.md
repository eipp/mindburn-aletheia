# Developer Guidelines for Mindburn Aletheia

This document provides guidelines for developers contributing to the Mindburn Aletheia project after the refactoring process.

## Code Structure

### Project Organization

The codebase follows a monorepo structure with packages organized as follows:

```
/
├── packages/
│   ├── shared/             # Shared utilities, types, and configurations
│   ├── core/               # Core functionality
│   ├── worker-bot/         # Worker bot implementation
│   ├── worker-interface/   # Worker interface
│   ├── payment-system/     # Payment system
│   └── ...                 # Other domain-specific packages
├── scripts/                # Build and utility scripts
├── config/                 # Global configuration files
└── docs/                   # Documentation
```

### Package Structure

Each package should maintain the following structure:

```
packages/package-name/
├── src/                    # Source code
│   ├── __tests__/          # Tests adjacent to the code being tested
│   ├── index.ts            # Main exports
│   └── [domain-specific directories]
├── package.json            # Package metadata and dependencies
├── tsconfig.json           # TypeScript configuration (extends root config)
└── README.md               # Package-specific documentation
```

## Coding Standards

### Naming Conventions

1. **Files**:

   - Use camelCase for general files (e.g., `tonService.ts`)
   - Use PascalCase for React components (e.g., `UserProfile.tsx`)
   - Use lowercase with dashes for configuration files (e.g., `tsconfig-base.json`)

2. **Directories**:

   - Use camelCase for directories (e.g., `utils/`)
   - Keep `__tests__` directories adjacent to tested code

3. **TypeScript/JavaScript**:
   - Use camelCase for variables and functions
   - Use PascalCase for classes and interfaces
   - Use UPPER_SNAKE_CASE for constants
   - Prefix types with "T" (e.g., `TConfig`)
   - Prefix enum types with "E" (e.g., `EStatus`)

### Code Style

All code must adhere to the project's ESLint and Prettier configurations. Run the following before submitting:

```bash
npm run lint
npm run format
```

### Imports

1. Organize imports in the following order:

   - Node.js built-in modules
   - External dependencies
   - Internal shared modules (@mindburn/shared)
   - Internal package-specific imports
   - Relative imports (parent, sibling, child)

2. Use aliases for imports from other packages:

   ```typescript
   // Good
   import { createLogger } from '@mindburn/shared';

   // Avoid
   import { createLogger } from '../../../packages/shared/src';
   ```

## Shared Utilities

### Using Shared Components

1. **Configuration**: Use the shared configuration factories:

   ```typescript
   import { createConfigValidator } from '@mindburn/shared/config';

   export const config = createConfigValidator({
     required: ['API_KEY'],
     optional: ['DEBUG'],
   });
   ```

2. **Logging**: Use the shared logger:

   ```typescript
   import { createLogger } from '@mindburn/shared/logger';

   const logger = createLogger('component-name');
   ```

3. **Validation**: Use the shared validation utilities:

   ```typescript
   import { validateAddress } from '@mindburn/shared/verification';

   if (!validateAddress(address)) {
     throw new Error('Invalid address');
   }
   ```

### Creating New Shared Utilities

When creating new functionality:

1. Determine if it should be shared or package-specific
2. If shared, place it in the appropriate category in `packages/shared`
3. Export it from the relevant index.ts file
4. Document its usage with JSDoc comments

## Testing Standards

1. **Test Placement**:

   - Place tests in `__tests__` directories adjacent to the code being tested
   - Name test files with the same name as the file being tested, with `.test.ts` suffix

2. **Test Coverage**:

   - Maintain at least 80% test coverage for all code
   - 100% coverage for critical path components (payment, verification)

3. **Test Types**:
   - Unit tests for individual functions/components
   - Integration tests for API endpoints and service combinations
   - End-to-end tests for critical user flows

## Documentation

1. **Code Documentation**:

   - Use JSDoc comments for all public APIs
   - Explain parameters, return values, and exceptions
   - Include examples for complex functionality

2. **Package Documentation**:

   - Each package should have a README.md explaining its purpose and usage
   - Document any package-specific configuration

3. **API Documentation**:
   - Document all API endpoints with request/response examples
   - Specify error codes and handling

## Pull Request Process

1. **Before Submitting**:

   - Ensure all tests pass
   - Run linting and formatting
   - Verify import paths are correct
   - Check that shared utilities are properly used

2. **PR Description**:

   - Clearly describe the changes made
   - Reference any related issues
   - Include steps to test/validate

3. **Code Review**:
   - Address all review comments
   - Maintain a collaborative attitude

## Maintaining the Structure

To ensure the codebase remains well-structured:

1. Run the validation script regularly:

   ```bash
   npm run refactor:validate
   ```

2. Periodically check for duplicated code:

   ```bash
   npm run analyze:duplication
   ```

3. Review circular dependencies:
   ```bash
   npm run refactor:circular
   ```

Following these guidelines will help maintain the quality and structure of the codebase established during the refactoring process.
