# Contributing to Mindburn Aletheia

Thank you for your interest in contributing to Mindburn Aletheia. This document provides guidelines and best practices to ensure we maintain a high-quality, well-organized codebase.

## Monorepo Structure

Mindburn Aletheia uses a monorepo structure with Turborepo. The repository is organized as follows:

```
mindburn-aletheia/
├── packages/           # Standalone package modules
│   ├── shared/         # Shared utilities and types
│   ├── worker-bot/     # Telegram bot implementation
│   ├── worker-webapp/  # Web application for workers
│   └── ...
├── src/                # Legacy code being migrated to packages
├── api/                # API specifications and implementations
├── docs/               # Documentation
└── infrastructure/     # Infrastructure as code
```

## Code Organization Guidelines

### 1. Package Ownership

Each package should have clear ownership and responsibility. Before creating a new file, consider:

- Which package should own this functionality?
- Does similar functionality already exist elsewhere?
- Should this be in a shared package instead?

### 2. Preventing Duplication

To prevent code duplication:

- **Search First**: Before implementing new functionality, search the codebase for similar implementations.
- **Use Shared Packages**: Common utilities, types, and functions should be in the `shared` package.
- **Follow Naming Conventions**: Use consistent naming patterns to make existing code discoverable.

### 3. Naming Conventions

- **Files**: Use `kebab-case` for filenames.
- **Classes**: Use `PascalCase` for class names.
- **Functions/Variables**: Use `camelCase` for functions and variables.
- **Constants**: Use `UPPER_SNAKE_CASE` for constants.
- **Interfaces/Types**: Use `PascalCase` with descriptive names.

Avoid adding version numbers or qualifiers like "Enhanced" to filenames or class names. Instead, create a single authoritative implementation with appropriate configuration options.

### 4. Directory Structure

Each package should follow a consistent structure:

```
package-name/
├── src/                # Source code
│   ├── index.ts        # Main exports
│   ├── types/          # Type definitions
│   │   └── index.ts
│   ├── utils/          # Utilities
│   │   └── index.ts
│   ├── components/     # For UI packages
│   └── services/       # Service implementations
├── tests/              # Tests
├── package.json        # Package definition
├── tsconfig.json       # TypeScript configuration
└── README.md           # Package documentation
```

### 5. Package Exports

- Each package should have a well-defined public API in its `index.ts` file.
- Use explicit exports instead of barrel exports (`export *`).
- For utility functions, export from `utils/index.ts`.
- For types, export from `types/index.ts`.

## Pull Request Process

When submitting a pull request:

1. **Dependency Mapping**: Document which other packages this change affects.
2. **Duplication Check**: Verify no duplication is being introduced. Use `jscpd` if necessary.
3. **Lint and Test**: Ensure all linters and tests pass.
4. **Reviewers**: Include package owners as reviewers.

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Run the development server with `pnpm dev`.
3. Build packages with `pnpm build`.
4. Test with `pnpm test`.

## Refactoring Legacy Code

We're gradually migrating code from the `src/` directory to the packages structure. When refactoring:

1. First move the code to the appropriate package.
2. Update imports in dependent files.
3. Add tests for the migrated code.
4. Update documentation.
5. Delete the old code only after all references have been updated.

## Tools for Detecting Duplication

- Run `jscpd` to detect code duplication:
  ```
  npx jscpd . --min-lines 10 --min-tokens 100 --threshold 80 --output ./jscpd-report --ignore "node_modules/**,dist/**,.git/**,.vscode/**,**/test/**,**/tests/**" --reporters "json,html"
  ```

- Use `depcheck` to find unused dependencies:
  ```
  npx depcheck
  ```

- Use `turbo-typecheck` to verify type compatibility:
  ```
  pnpm turbo typecheck
  ```

## Style Guide

We follow the Airbnb JavaScript Style Guide with TypeScript extensions. Key points:

- Use TypeScript for all new code.
- Write comprehensive JSDoc comments for public APIs.
- Use functional programming patterns where appropriate.
- Prefer immutability and pure functions.
- Use async/await instead of Promises.

## Questions?

If you have questions about the codebase organization or contribution process, please reach out to the maintainers. 