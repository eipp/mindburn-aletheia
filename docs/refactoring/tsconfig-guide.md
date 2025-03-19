# TypeScript Configuration Guide

This guide explains the TypeScript configuration structure in the Mindburn Aletheia monorepo.

## Configuration Structure

The TypeScript configuration is organized in a hierarchical manner:

1. **Base Configuration** (`tsconfig.base.json`): Contains common settings for all packages
2. **Root Configuration** (`tsconfig.json`): Extends the base configuration and sets up paths for the monorepo
3. **Package-Specific Configurations** (`packages/*/tsconfig.json`): Extend the base configuration with package-specific settings

## Base Configuration

The `tsconfig.base.json` file contains common TypeScript settings that apply to all packages:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "strict": true,
    // ... other strict settings
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Root Configuration

The root `tsconfig.json` extends the base configuration and sets up paths for the monorepo:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@mindburn/*": ["packages/*/src"]
    }
  },
  "include": ["packages/*/src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Package-Specific Configuration

Each package should have its own `tsconfig.json` that extends the base configuration:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Special Configurations

### React Applications

For React applications (e.g., `packages/worker-webapp`), use:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Node.js Applications

For Node.js applications (e.g., `packages/worker-bot`), use:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Usage

### Importing from Other Packages

Use the `@mindburn/*` path alias to import from other packages:

```typescript
// Import from another package
import { logger } from '@mindburn/shared';

// Import from the same package
import { someFunction } from './utils';
```

### Type Declarations

Place type declarations in a `types.ts` file within the relevant directory:

```typescript
// src/features/user/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}
```

## Migration

To migrate existing package configurations:

1. Update each package's `tsconfig.json` to extend the base configuration
2. Remove duplicate settings that are already in the base configuration
3. Add package-specific settings as needed

## Benefits

This configuration structure provides several benefits:

1. **Consistency**: All packages use the same base settings
2. **Maintainability**: Changes to common settings only need to be made in one place
3. **Flexibility**: Packages can override settings as needed
4. **Type Safety**: Strict type checking is enforced across the codebase
