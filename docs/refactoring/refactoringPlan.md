# Mindburn Aletheia Refactoring Plan

Based on the codebase analysis, this document outlines a comprehensive refactoring plan to improve code organization, maintainability, and consistency.

## 1. Standardize Naming Conventions

### Current State
- Mixed naming conventions across the codebase:
  - camelCase: 203 files (dominant)
  - PascalCase: 109 files
  - kebab-case: 75 files
  - snake_case: 8 files

### Action Plan
1. **Create a naming convention guide**:
   - Use camelCase for variables, functions, and file names (except React components)
   - Use PascalCase for React components, classes, and interfaces
   - Use kebab-case for directory names
   - Use UPPER_SNAKE_CASE for constants

2. **Implement a batch renaming script**:
   ```javascript
   // scripts/refactoring/rename-files.js
   // This script will rename files according to the naming convention
   ```

3. **Update imports after renaming**:
   - Use the refactoring script to update all imports after renaming files

## 2. Consolidate Duplicate Directories

### Current State
- Multiple test directories (5 locations)
- Multiple verification directories (4 locations)
- Multiple config directories (7 locations)
- Multiple utils directories (7 locations)
- Multiple tests directories (4 locations)
- Multiple __tests__ directories (8 locations)

### Action Plan
1. **Consolidate test directories**:
   - Move all test files to a standardized location within each package
   - Use `__tests__` directories adjacent to the files they test
   - Eliminate standalone test directories

2. **Consolidate verification logic**:
   - Move all verification code to `packages/verification-engine`
   - Create clear interfaces for other packages to use

3. **Centralize configuration**:
   - Move shared configuration to `packages/shared/src/config`
   - Keep package-specific configuration within each package
   - Use a consistent pattern for configuration management

4. **Consolidate utilities**:
   - Move common utilities to `packages/shared/src/utils`
   - Organize utilities by domain (e.g., `ton`, `validation`, `formatting`)
   - Use the refactor-module.js script to assist with migration

## 3. Centralize Configuration Files

### Current State
- 45 configuration files scattered across the codebase
- Multiple tsconfig.json files with potential duplication

### Action Plan
1. **Create a base tsconfig.json**:
   - Define common TypeScript settings in the root tsconfig.json
   - Use extends in package-specific tsconfig.json files

2. **Standardize ESLint and Prettier configuration**:
   - Use a single .eslintrc.js and .prettierrc at the root
   - Add package-specific overrides where necessary

3. **Centralize build configuration**:
   - Standardize build scripts in package.json files
   - Use turbo.json for build dependencies

## 4. Organize Scripts

### Current State
- 6 scripts with various purposes
- No clear organization

### Action Plan
1. **Create script directories by purpose**:
   - `scripts/analysis/` - For codebase analysis scripts
   - `scripts/deployment/` - For deployment scripts
   - `scripts/refactoring/` - For refactoring tools
   - `scripts/build/` - For build scripts
   - `scripts/utils/` - For utility scripts

2. **Document each script**:
   - Add a README.md in each script directory
   - Include usage examples and purpose

## 5. Update .gitignore

### Current State
- 4 unnecessary files tracked in version control

### Action Plan
1. **Update .gitignore to exclude**:
   - .DS_Store
   - pnpm-lock.yaml (use only yarn.lock)
   - Generated files (build artifacts, coverage reports)

## 6. Improve Monorepo Structure

### Current State
- Inconsistent package organization
- Unclear boundaries between packages

### Action Plan
1. **Define clear package boundaries**:
   - `packages/shared` - Common utilities, types, and services
   - `packages/verification-engine` - Core verification logic
   - `packages/worker-bot` - Telegram bot interface
   - `packages/worker-webapp` - Web interface
   - `packages/payment-system` - Payment processing
   - `packages/developer-platform` - Developer APIs and dashboard

2. **Standardize package structure**:
   - src/ - Source code
   - __tests__/ - Tests adjacent to source files
   - docs/ - Package-specific documentation

## Implementation Plan

### Phase 1: Preparation (Week 1)
- [x] Create analysis scripts
- [ ] Create naming convention guide
- [ ] Update .gitignore
- [ ] Create batch renaming script

### Phase 2: Configuration Standardization (Week 2)
- [ ] Centralize and standardize TypeScript configuration
- [ ] Standardize ESLint and Prettier configuration
- [ ] Organize scripts into directories

### Phase 3: Directory Consolidation (Weeks 3-4)
- [ ] Consolidate test directories
- [ ] Consolidate verification logic
- [ ] Centralize shared configuration
- [ ] Consolidate utilities

### Phase 4: File Renaming (Week 5)
- [ ] Rename files according to naming convention
- [ ] Update imports after renaming

### Phase 5: Documentation and Validation (Week 6)
- [ ] Update documentation to reflect new structure
- [ ] Run tests to ensure functionality is preserved
- [ ] Create developer guidelines for future contributions

## Success Metrics

- Reduced duplication (target: 100% reduction in duplicate directories)
- Consistent naming conventions (target: 100% compliance)
- Centralized configuration (target: 50% reduction in config files)
- Improved test organization (target: 100% of tests in __tests__ directories)
- Maintained or improved test coverage (target: 100% coverage)

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes | High | Medium | Comprehensive testing after each phase |
| Developer resistance | Medium | Low | Clear documentation and training |
| Time constraints | Medium | Medium | Prioritize high-impact changes first |
| Integration issues | High | Medium | Incremental changes with validation |

## Conclusion

This refactoring plan addresses the key issues identified in the codebase analysis. By implementing these changes, we will improve code organization, reduce duplication, and establish clear patterns for future development. The phased approach ensures that we can make progress while minimizing disruption to ongoing development. 