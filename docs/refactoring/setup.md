# Refactoring Setup Guide

This document outlines the setup process and tools required for the Mindburn Aletheia codebase refactoring.

## Required Tools

### Code Analysis Tools
- **jscpd**: Detects code duplication in the codebase
  ```bash
  npm install -g jscpd
  ```

- **depcheck**: Finds unused dependencies in package.json files
  ```bash
  npm install -g depcheck
  ```

- **tree**: Visualizes directory structures
  ```bash
  # macOS
  brew install tree
  
  # Linux (Debian/Ubuntu)
  apt-get install tree
  ```

### Refactoring Scripts
The repository contains several refactoring scripts located in `scripts/`:
- `refactor-module.js`: Helps move modules between packages

## Setup Process

1. Install the required global tools:
   ```bash
   npm install -g jscpd depcheck
   ```

2. Make all refactoring scripts executable:
   ```bash
   chmod +x scripts/*.js
   ```

3. Create necessary directories for analysis artifacts:
   ```bash
   mkdir -p docs/analysis
   ```

## Running Analysis

1. Generate directory tree:
   ```bash
   tree -a -I "node_modules|.git" > docs/analysis/tree.txt
   ```

2. Find code duplication:
   ```bash
   jscpd . --ignore "node_modules/**" --reporters "html,json" --output docs/analysis
   ```

3. Check for unused dependencies:
   ```bash
   # Run for root package
   depcheck . > docs/analysis/depcheck-root.txt
   
   # Run for each sub-package
   for pkg in packages/*; do
     if [ -f "$pkg/package.json" ]; then
       depcheck $pkg > docs/analysis/depcheck-$(basename $pkg).txt
     fi
   done
   ```

## Refactoring Workflow

1. Analysis: Review the generated reports
2. Planning: Document proposed changes
3. Execution: Make changes in small, testable increments
4. Validation: Ensure tests pass after each change
5. Documentation: Update project documentation

## Important Guidelines

- **Make backups** before significant changes
- **Commit often** with descriptive messages 
- **Run tests** after each refactoring step
- **Keep the team informed** about changes affecting multiple components 