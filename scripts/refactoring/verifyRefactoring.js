#!/usr/bin/env node

/**
 * Refactoring Verification Script
 * 
 * This script validates that the refactoring has been completed successfully
 * by checking:
 * 1. Shared utilities are being used correctly
 * 2. Naming conventions are followed
 * 3. TypeScript configurations are standardized
 * 4. Scripts are organized properly
 * 5. No duplicate implementations exist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES_DIR = path.join(process.cwd(), 'packages');
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');

// Terminal colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const SUCCESS = `${GREEN}✓${RESET}`;
const WARNING = `${YELLOW}⚠${RESET}`;
const ERROR = `${RED}✗${RESET}`;

// Results tracking
const results = {
  passed: 0,
  warnings: 0,
  errors: 0,
  details: []
};

/**
 * Main verification function
 */
async function verifyRefactoring() {
  console.log(`${BOLD}\n🔍 Verifying Refactoring Changes\n${RESET}`);

  // 1. Verify shared utilities
  await verifySharedUtilities();
  
  // 2. Verify naming conventions
  await verifyNamingConventions();
  
  // 3. Verify TypeScript configurations
  await verifyTypeScriptConfigs();
  
  // 4. Verify script organization
  await verifyScriptOrganization();
  
  // 5. Verify no duplicate implementations
  await verifyNoDuplicates();

  // Print results
  printResults();
}

/**
 * Verify that shared utilities are being used correctly
 */
async function verifySharedUtilities() {
  console.log(`${BOLD}Verifying Shared Utilities Usage:${RESET}`);
  
  // Check TON utilities usage
  const tonImports = findImportsInFiles(['packages/*/src/**/*.ts'], '@mindburn/shared', 'ton');
  if (tonImports.length > 0) {
    addResult(SUCCESS, 'Shared TON utilities are being imported', { count: tonImports.length });
  } else {
    addResult(ERROR, 'No imports of shared TON utilities found', { suggestion: 'Check that packages are using @mindburn/shared import' });
  }

  // Check logger usage
  const loggerImports = findImportsInFiles(['packages/*/src/**/*.ts'], '@mindburn/shared', 'logger');
  if (loggerImports.length > 0) {
    addResult(SUCCESS, 'Shared logger is being imported', { count: loggerImports.length });
  } else {
    addResult(ERROR, 'No imports of shared logger found', { suggestion: 'Check that packages are using @mindburn/shared import for logging' });
  }

  // Check verification service usage
  const verificationImports = findImportsInFiles(['packages/*/src/**/*.ts'], '@mindburn/verification-engine', 'FraudDetector');
  if (verificationImports.length > 0) {
    addResult(SUCCESS, 'Verification engine is being imported', { count: verificationImports.length });
  } else {
    addResult(WARNING, 'No imports of verification engine found', { suggestion: 'Verify that services are using the shared verification engine' });
  }

  console.log();
}

/**
 * Verify that naming conventions are followed
 */
async function verifyNamingConventions() {
  console.log(`${BOLD}Verifying Naming Conventions:${RESET}`);
  
  // Check for camelCase file names in TypeScript files
  const tsFiles = findFiles(['packages/*/src/**/*.ts'], true);
  const nonCamelCaseFiles = tsFiles.filter(file => {
    const filename = path.basename(file);
    return !isCamelCase(filename) && !isPascalCase(filename) && filename !== 'index.ts';
  });
  
  if (nonCamelCaseFiles.length === 0) {
    addResult(SUCCESS, 'TypeScript files follow naming conventions');
  } else {
    addResult(WARNING, 'Some TypeScript files do not follow naming conventions', { 
      count: nonCamelCaseFiles.length,
      files: nonCamelCaseFiles.slice(0, 5) 
    });
  }

  // Check for kebab-case directory names
  const directories = findDirectories(['packages/*/src/**'], true);
  const nonKebabDirectories = directories.filter(dir => {
    const dirname = path.basename(dir);
    // Skip __tests__ directories as they follow a standard naming convention
    if (dirname === '__tests__') {
      return false;
    }
    // Accept PascalCase for React component directories
    if (isPascalCase(dirname) && dir.includes('components') || dir.includes('pages')) {
      return false;
    }
    return !isKebabCase(dirname) && !isCamelCase(dirname);
  });
  
  if (nonKebabDirectories.length === 0) {
    addResult(SUCCESS, 'Directories follow naming conventions');
  } else {
    addResult(WARNING, 'Some directories do not follow naming conventions', { 
      count: nonKebabDirectories.length,
      directories: nonKebabDirectories.slice(0, 5) 
    });
  }

  console.log();
}

/**
 * Verify that TypeScript configurations are standardized
 */
async function verifyTypeScriptConfigs() {
  console.log(`${BOLD}Verifying TypeScript Configurations:${RESET}`);
  
  // Get all package directories
  const packageDirs = fs.readdirSync(PACKAGES_DIR)
    .filter(name => fs.statSync(path.join(PACKAGES_DIR, name)).isDirectory())
    .map(name => path.join(PACKAGES_DIR, name));
  
  // Check if each package has a tsconfig.json
  const packagesWithoutTsconfig = [];
  const nonStandardTsconfigs = [];
  
  for (const packageDir of packageDirs) {
    const tsconfigPath = path.join(packageDir, 'tsconfig.json');
    
    if (!fs.existsSync(tsconfigPath)) {
      packagesWithoutTsconfig.push(packageDir);
      continue;
    }
    
    // Check if the tsconfig extends the base config
    try {
      const config = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      if (!config.extends || !config.extends.includes('tsconfig.base.json')) {
        nonStandardTsconfigs.push(tsconfigPath);
      }
    } catch (error) {
      nonStandardTsconfigs.push(tsconfigPath);
    }
  }
  
  if (packagesWithoutTsconfig.length === 0) {
    addResult(SUCCESS, 'All packages have TypeScript configuration');
  } else {
    addResult(ERROR, 'Some packages are missing TypeScript configuration', { 
      packages: packagesWithoutTsconfig.map(dir => path.basename(dir))
    });
  }
  
  if (nonStandardTsconfigs.length === 0) {
    addResult(SUCCESS, 'All TypeScript configurations extend the base config');
  } else {
    addResult(ERROR, 'Some TypeScript configurations do not extend the base config', { 
      count: nonStandardTsconfigs.length,
      files: nonStandardTsconfigs.map(file => path.relative(process.cwd(), file))
    });
  }

  console.log();
}

/**
 * Verify that scripts are organized properly
 */
async function verifyScriptOrganization() {
  console.log(`${BOLD}Verifying Script Organization:${RESET}`);
  
  // Check if script categories exist
  const expectedScriptDirs = ['analysis', 'deployment', 'refactoring'];
  const missingScriptDirs = expectedScriptDirs.filter(dir => 
    !fs.existsSync(path.join(SCRIPTS_DIR, dir))
  );
  
  if (missingScriptDirs.length === 0) {
    addResult(SUCCESS, 'Script directories are properly organized');
  } else {
    addResult(ERROR, 'Missing expected script directories', { 
      missing: missingScriptDirs 
    });
  }
  
  // Check if script directories have README.md files
  const scriptDirs = fs.readdirSync(SCRIPTS_DIR)
    .filter(name => 
      fs.statSync(path.join(SCRIPTS_DIR, name)).isDirectory() &&
      expectedScriptDirs.includes(name)
    );
  
  const dirsWithoutReadme = scriptDirs.filter(dir => 
    !fs.existsSync(path.join(SCRIPTS_DIR, dir, 'README.md'))
  );
  
  if (dirsWithoutReadme.length === 0) {
    addResult(SUCCESS, 'All script directories have README files');
  } else {
    addResult(WARNING, 'Some script directories are missing README files', { 
      directories: dirsWithoutReadme 
    });
  }

  console.log();
}

/**
 * Verify that there are no duplicate implementations
 */
async function verifyNoDuplicates() {
  console.log(`${BOLD}Verifying No Duplicate Implementations:${RESET}`);
  
  // Check for Enhanced/Advanced file name patterns
  const enhancedFiles = findFiles(['packages/*/src/**/*Enhanced*.ts', 'packages/*/src/**/*Advanced*.ts', 'src/**/*Enhanced*.ts', 'src/**/*Advanced*.ts'], true);
  
  if (enhancedFiles.length === 0) {
    addResult(SUCCESS, 'No Enhanced/Advanced file patterns found');
  } else {
    addResult(ERROR, 'Enhanced/Advanced file patterns found - these should be consolidated', { 
      files: enhancedFiles.map(file => path.relative(process.cwd(), file))
    });
  }
  
  // Check for multiple TON service implementations
  const tonServiceFiles = findFiles(['packages/*/src/**/ton.ts'], true);
  
  // Exclude files that properly import the shared TonService
  const properTonServicePatterns = [
    'import { TonService',
    'createTonService',
    'export { tonService',
    'import { TonNetworkConfig }'
  ];
  
  const nonSharedTonServiceFiles = [];
  
  for (const file of tonServiceFiles) {
    // Skip shared services implementation and configuration files
    if (file.includes('packages/shared/src/services/ton.ts') || 
        file.includes('packages/shared/src/utils/ton.ts') ||
        file.includes('packages/worker-webapp/src/config/ton.ts')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    // Consider it a proper implementation if it uses the shared service
    let usesSharedService = false;
    
    for (const pattern of properTonServicePatterns) {
      if (content.includes(pattern)) {
        usesSharedService = true;
        break;
      }
    }
    
    if (!usesSharedService) {
      nonSharedTonServiceFiles.push(file);
    }
  }
  
  if (nonSharedTonServiceFiles.length === 0) {
    addResult(SUCCESS, 'All TON service implementations use the shared service');
  } else {
    addResult(WARNING, 'Multiple TON service implementations found - review for possible consolidation', { 
      count: nonSharedTonServiceFiles.length,
      files: nonSharedTonServiceFiles.map(file => path.relative(process.cwd(), file))
    });
  }

  console.log();
}

// Helper Functions

/**
 * Find import statements in files
 */
function findImportsInFiles(patterns, packageName, importName) {
  try {
    const cmd = `grep -r "import.*${importName}.*from.*${packageName}" ${patterns.join(' ')} --include="*.ts" --include="*.tsx" || true`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return output.split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * Find files matching patterns
 */
function findFiles(patterns, returnFullPath = false) {
  try {
    const allFiles = [];
    for (const pattern of patterns) {
      // Use ls instead of find for better pattern matching
      const cmd = `ls -1 ${pattern} 2>/dev/null || true`;
      const output = execSync(cmd, { encoding: 'utf8' });
      const files = output.split('\n').filter(f => f.trim());
      allFiles.push(...files);
    }
    return returnFullPath ? allFiles : allFiles.map(file => path.basename(file));
  } catch (error) {
    console.error(`Error finding files: ${error.message}`);
    return [];
  }
}

/**
 * Find directories matching patterns
 */
function findDirectories(patterns, returnFullPath = false) {
  try {
    const allDirs = [];
    for (const pattern of patterns) {
      const cmd = `find ${pattern} -type d 2>/dev/null || true`;
      const output = execSync(cmd, { encoding: 'utf8' });
      const dirs = output.split('\n').filter(d => d.trim());
      allDirs.push(...dirs);
    }
    return returnFullPath ? allDirs : allDirs.map(dir => path.basename(dir));
  } catch (error) {
    return [];
  }
}

/**
 * Check if a string is camelCase
 */
function isCamelCase(str) {
  return /^[a-z][a-zA-Z0-9]*$/.test(str.split('.')[0]);
}

/**
 * Check if a string is PascalCase
 */
function isPascalCase(str) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str.split('.')[0]);
}

/**
 * Check if a string is kebab-case
 */
function isKebabCase(str) {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(str);
}

/**
 * Add a result to the results collection
 */
function addResult(icon, message, details = {}) {
  if (icon === SUCCESS) {
    results.passed++;
    console.log(`  ${icon} ${message}`);
  } else if (icon === WARNING) {
    results.warnings++;
    console.log(`  ${icon} ${message}`);
  } else {
    results.errors++;
    console.log(`  ${icon} ${message}`);
  }
  
  if (Object.keys(details).length > 0) {
    for (const [key, value] of Object.entries(details)) {
      if (Array.isArray(value) && value.length > 0) {
        console.log(`    - ${key}: ${value.length > 5 ? `${value.slice(0, 5).join(', ')}... (${value.length} total)` : value.join(', ')}`);
      } else {
        console.log(`    - ${key}: ${value}`);
      }
    }
  }
  
  results.details.push({ icon, message, details });
}

/**
 * Print the final results
 */
function printResults() {
  console.log(`${BOLD}\n📊 Refactoring Verification Results:${RESET}`);
  console.log(`  ${SUCCESS} Passed: ${results.passed}`);
  console.log(`  ${WARNING} Warnings: ${results.warnings}`);
  console.log(`  ${ERROR} Errors: ${results.errors}`);
  
  if (results.errors > 0) {
    console.log(`${RED}\n❌ Refactoring verification failed with errors${RESET}`);
    console.log(`${YELLOW}Please fix the reported issues and run verification again${RESET}`);
  } else if (results.warnings > 0) {
    console.log(`${YELLOW}\n⚠️ Refactoring verification completed with warnings${RESET}`);
    console.log(`${YELLOW}Consider addressing the warnings for a fully compliant codebase${RESET}`);
  } else {
    console.log(`${GREEN}\n✅ Refactoring verification completed successfully!${RESET}`);
    console.log(`${GREEN}All checks passed - the codebase meets the refactoring standards${RESET}`);
  }
}

// Run the verification
verifyRefactoring().catch(error => {
  console.error(`${RED}Error running verification:${RESET}`, error);
  process.exit(1);
}); 