# Naming Convention Guide

## File Naming Conventions

1. **TypeScript/JavaScript Files**
   - Use camelCase for general files (e.g., `tonService.ts`, `configUtil.ts`)
   - Use PascalCase for React components (e.g., `UserProfile.tsx`, `TaskList.tsx`)
   - Use lowercase with dashes for configuration files (e.g., `tsconfig-base.json`)

2. **Directory Naming**
   - Use camelCase for directories (e.g., `services`, `utils`)
   - Keep `__tests__` directories adjacent to tested code
   - Maintain a flat directory structure, max 3 levels deep

3. **Special Files**
   - Use lowercase with dots for config files (e.g., `.eslintrc.js`, `.prettierrc`)
   - Use UPPERCASE for documentation files (e.g., `README.md`, `CONTRIBUTING.md`)

## TypeScript/JavaScript Naming

1. **Variables and Functions**
   - Use camelCase for variables and functions (e.g., `userData`, `fetchUser()`)
   - Use descriptive names that clearly indicate purpose
   - Prefix boolean variables with "is", "has", or "should" (e.g., `isActive`, `hasPermission`)

2. **Classes and Interfaces**
   - Use PascalCase for classes and interfaces (e.g., `UserService`, `TaskManager`)
   - Suffix interfaces with their type when appropriate (e.g., `UserInterface`, `ConfigOptions`)
   - Suffix service classes with "Service" (e.g., `TonService`, `NotificationService`)

3. **Constants**
   - Use UPPER_SNAKE_CASE for constants (e.g., `MAX_RETRY_COUNT`, `API_BASE_URL`)

4. **Type Definitions**
   - Prefix types with "T" (e.g., `TUser`, `TConfig`)
   - Prefix enum types with "E" (e.g., `EStatus`, `ERole`)

## Directory Structure Standards

1. **Package Organization**
   - Keep related files together in the same directory
   - Place test files in `__tests__` directories adjacent to the code being tested
   - Store shared utilities in `packages/shared`

2. **Path Structure**
   - Use path aliases for imports (e.g., `@mindburn/shared` instead of `../../../packages/shared`)
   - Maintain consistent import patterns

## Implementation Rules

1. Follow these patterns for service implementation:
   ```typescript
   // Service factory pattern
   export const createTonService = (config, logger) => {
     return new TonService(config, logger);
   };
   
   // Service class pattern
   export class TonService {
     constructor(config, logger) {
       // initialization
     }
     
     // methods
   }
   ```

2. Test file naming should match the file being tested:
   ```
   services/
     tonService.ts
     __tests__/
       tonService.test.ts
   ```

## Batch Renaming Rules

When using the batch renaming script, follow these principles:
1. Ensure consistent casing (camelCase for files, PascalCase for components)
2. Keep only one concept per file
3. Name files according to their primary function or export
4. Avoid generic names like "util.ts" or "helpers.ts"
5. Avoid including file types in names (e.g., use `userProfile.ts` not `userProfileComponent.ts`) 