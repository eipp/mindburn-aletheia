#!/usr/bin/env node

/**
 * Refactoring Validation Script
 * 
 * This script validates that the refactoring process has not broken any functionality
 * by running tests and verifying imports.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  logFile: 'refactoring-validation-log.json',
  testCommand: 'npm run test:all',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build'
};

// Log for recording validation results
const validationLog = {
  timestamp: new Date().toISOString(),
  testsResult: null,
  lintResult: null,
  buildResult: null,
  importErrors: [],
  packageProblems: []
};

/**
 * Run a command and capture output
 */
function runCommand(command) {
  console.log(`Running: ${command}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    return {
      success: true,
      output: output
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout,
      stderr: error.stderr
    };
  }
}

/**
 * Check for broken imports in the codebase
 */
function checkBrokenImports() {
  console.log('Checking for broken imports...');
  
  const errors = [];
  const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  const includedDirs = tsconfig.include || ['packages/*/src'];
  
  for (const pattern of includedDirs) {
    // Convert glob pattern to a directory
    const baseDir = pattern.replace(/\*/g, '').replace(/\/+$/, '');
    
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    
    const command = `npx tsc --noEmit --incremental false --project tsconfig.json`;
    const result = runCommand(command);
    
    if (!result.success) {
      // Extract import errors from the TypeScript output
      const importErrors = result.output.split('\n')
        .filter(line => line.includes("Cannot find module") || line.includes("File not found"));
      
      errors.push(...importErrors);
    }
  }
  
  return errors;
}

/**
 * Validate that each package has required files
 */
function validatePackages() {
  console.log('Validating packages...');
  
  const problems = [];
  const packagesDir = path.join(process.cwd(), 'packages');
  
  if (!fs.existsSync(packagesDir)) {
    problems.push('Packages directory not found');
    return problems;
  }
  
  // New package names using camelCase
  const expectedPackages = [
    'core',
    'developerPlatform',
    'paymentSystem',
    'pluginSystem',
    'taskManagement',
    'tokenEconomy',
    'tonContracts',
    'verificationEngine',
    'workerBot',
    'workerCore',
    'workerInterface',
    'workerWebapp',
    'shared'
  ];
  
  // Check that each expected package exists and has required files
  for (const pkg of expectedPackages) {
    const packageDir = path.join(packagesDir, pkg);
    
    // Check if package directory exists
    if (!fs.existsSync(packageDir)) {
      if (['developerPlatform', 'paymentSystem', 'pluginSystem', 
           'taskManagement', 'tokenEconomy', 'tonContracts', 
           'verificationEngine', 'workerBot', 'workerCore', 
           'workerInterface', 'workerWebapp'].includes(pkg)) {
        // These are the new directories we created, so they should exist
        problems.push(`Missing package directory: ${pkg}`);
      }
      continue;
    }
    
    // Check for essential files
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts'
    ];
    
    for (const file of essentialFiles) {
      const filePath = path.join(packageDir, file);
      if (!fs.existsSync(filePath)) {
        problems.push(`Missing ${file} in ${pkg}`);
      }
    }
    
    // Verify package.json has correct configuration
    try {
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (!packageJson.name || !packageJson.name.startsWith('@mindburn/')) {
          problems.push(`Package ${pkg} has incorrect name format: ${packageJson.name}`);
        }
        
        if (!packageJson.main || !packageJson.main.includes('dist')) {
          problems.push(`Package ${pkg} has incorrect main field: ${packageJson.main}`);
        }
      }
    } catch (error) {
      problems.push(`Error parsing package.json for ${pkg}: ${error.message}`);
    }
  }
  
  return problems;
}

/**
 * Main function
 */
async function main() {
  console.log('Validating refactoring...');
  
  const skipTests = process.argv.includes('--skip-tests');
  const skipLint = process.argv.includes('--skip-lint');
  const skipBuild = process.argv.includes('--skip-build');
  
  // 1. Run tests
  if (!skipTests) {
    console.log('\n=== Running Tests ===');
    validationLog.testsResult = runCommand(CONFIG.testCommand);
    
    if (validationLog.testsResult.success) {
      console.log('✅ Tests passed successfully');
    } else {
      console.error('❌ Tests failed');
      console.error(validationLog.testsResult.output);
    }
  } else {
    console.log('\n=== Skipping Tests ===');
    validationLog.testsResult = { success: true, skipped: true };
  }
  
  // 2. Run linting
  if (!skipLint) {
    console.log('\n=== Running Linting ===');
    validationLog.lintResult = runCommand(CONFIG.lintCommand);
    
    if (validationLog.lintResult.success) {
      console.log('✅ Linting passed successfully');
    } else {
      console.error('❌ Linting failed');
      console.error(validationLog.lintResult.output);
    }
  } else {
    console.log('\n=== Skipping Linting ===');
    validationLog.lintResult = { success: true, skipped: true };
  }
  
  // 3. Run build
  if (!skipBuild) {
    console.log('\n=== Running Build ===');
    validationLog.buildResult = runCommand(CONFIG.buildCommand);
    
    if (validationLog.buildResult.success) {
      console.log('✅ Build passed successfully');
    } else {
      console.error('❌ Build failed');
      console.error(validationLog.buildResult.output);
    }
  } else {
    console.log('\n=== Skipping Build ===');
    validationLog.buildResult = { success: true, skipped: true };
  }
  
  // 4. Check for broken imports
  console.log('\n=== Checking for broken imports ===');
  validationLog.importErrors = checkBrokenImports();
  
  if (validationLog.importErrors.length === 0) {
    console.log('✅ No broken imports found');
  } else {
    console.error(`❌ Found ${validationLog.importErrors.length} broken imports`);
    validationLog.importErrors.forEach(err => console.error(err));
  }
  
  // 5. Validate packages
  console.log('\n=== Validating packages ===');
  validationLog.packageProblems = validatePackages();
  
  if (validationLog.packageProblems.length === 0) {
    console.log('✅ All packages pass validation');
  } else {
    console.error(`❌ Found ${validationLog.packageProblems.length} package problems`);
    validationLog.packageProblems.forEach(problem => console.error(problem));
  }
  
  // Overall validation result
  const isValid = 
    (validationLog.testsResult.success || skipTests) && 
    (validationLog.lintResult.success || skipLint) && 
    (validationLog.buildResult.success || skipBuild) && 
    validationLog.importErrors.length === 0 && 
    validationLog.packageProblems.length === 0;
  
  console.log('\n=== Validation Summary ===');
  console.log(`Tests: ${skipTests ? 'SKIPPED' : (validationLog.testsResult.success ? 'PASS' : 'FAIL')}`);
  console.log(`Lint: ${skipLint ? 'SKIPPED' : (validationLog.lintResult.success ? 'PASS' : 'FAIL')}`);
  console.log(`Build: ${skipBuild ? 'SKIPPED' : (validationLog.buildResult.success ? 'PASS' : 'FAIL')}`);
  console.log(`Imports: ${validationLog.importErrors.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Packages: ${validationLog.packageProblems.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Overall: ${isValid ? 'PASS' : 'FAIL'}`);
  
  // Write the log file
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(validationLog, null, 2));
  console.log(`\nLog written to ${CONFIG.logFile}`);
  
  // Exit with appropriate code
  process.exit(isValid ? 0 : 1);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 