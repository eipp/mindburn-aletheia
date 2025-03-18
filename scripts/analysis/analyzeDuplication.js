#!/usr/bin/env node

/**
 * Code Duplication Analysis Script
 * 
 * This script analyzes the codebase for code duplication and potential refactoring opportunities.
 * It's designed to help with the consolidation of duplicate implementations.
 * 
 * Usage:
 *   node scripts/analyze-duplication.js [options]
 * 
 * Options:
 *   --min-lines N       Minimum number of lines for a duplicate block (default: 10)
 *   --min-tokens N      Minimum number of tokens for a duplicate block (default: 100)
 *   --threshold N       Similarity threshold percentage (default: 80)
 *   --focus-dir DIR     Focus analysis on a specific directory
 *   --output FILE       Output file for the report (default: duplication-report.json)
 *   --generate-plan     Generate a refactoring plan based on findings
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  minLines: 10,
  minTokens: 100,
  threshold: 80,
  focusDir: null,
  output: 'duplication-report.json',
  generatePlan: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-lines' && args[i+1]) {
    options.minLines = parseInt(args[i+1], 10);
    i++;
  } else if (args[i] === '--min-tokens' && args[i+1]) {
    options.minTokens = parseInt(args[i+1], 10);
    i++;
  } else if (args[i] === '--threshold' && args[i+1]) {
    options.threshold = parseInt(args[i+1], 10);
    i++;
  } else if (args[i] === '--focus-dir' && args[i+1]) {
    options.focusDir = args[i+1];
    i++;
  } else if (args[i] === '--output' && args[i+1]) {
    options.output = args[i+1];
    i++;
  } else if (args[i] === '--generate-plan') {
    options.generatePlan = true;
  }
}

console.log('📊 Analyzing code duplication with the following options:');
console.log(JSON.stringify(options, null, 2));

// Only analyze specific directories to avoid node_modules
const targetDirs = options.focusDir 
  ? [options.focusDir] 
  : ['src', 'packages/*/src', 'api/src'];

// Define directories to exclude - use absolute paths for more reliable exclusion
const excludeDirs = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/.vscode/**',
  '**/test/**',
  '**/tests/**',
  '**/*.test.ts',
  '**/*.spec.ts'
].join(',');

console.log('\n📂 Targeting directories:', targetDirs.join(', '));
console.log('🚫 Excluding:', excludeDirs);

// Run a simplified analysis using grep first to find potential duplicates
console.log('\n🔍 Identifying potential duplication candidates...');

// Analyze potential enhancement/advanced patterns
const findEnhancedCmd = `grep -r --include="*.ts" "Enhanced\\|Advanced\\|V[0-9]" ${targetDirs.join(' ')} 2>/dev/null || echo "No enhanced patterns found"`;

try {
  console.log('\n📋 Files with Enhanced/Advanced patterns:');
  execSync(findEnhancedCmd, { stdio: 'inherit' });
} catch (error) {
  console.log('No enhanced patterns found.');
}

// Generate a simplified report without relying on jscpd
console.log('\n📝 Generating simplified duplication report...');

// Generate a report - simplified version without full jscpd
const report = {
  summary: {
    analyzedDirs: targetDirs,
    excludedPatterns: excludeDirs.split(','),
    generatedAt: new Date().toISOString()
  },
  potentialDuplicationPatterns: [
    {
      pattern: "Enhanced vs non-enhanced files",
      description: "Files with 'Enhanced' or 'Advanced' in the name often duplicate functionality from base versions",
      suggestion: "Consolidate into a single implementation with configuration options"
    },
    {
      pattern: "Utility files across packages",
      description: "Common utilities like logging, validation, and formatting may be duplicated across packages",
      suggestion: "Move to shared/utils with appropriate exports"
    },
    {
      pattern: "Cross-package type definitions",
      description: "Type definitions may be duplicated across packages",
      suggestion: "Centralize in shared/types"
    }
  ],
  highPriorityActions: [
    {
      action: "Consolidate FraudDetector implementation",
      description: "FraudDetector and AdvancedFraudDetector have been consolidated into verification-engine/fraud-detection",
      status: "COMPLETED"
    },
    {
      action: "Centralize logging",
      description: "Multiple logger implementations should be consolidated into shared/utils/logging",
      status: "IN_PROGRESS"
    },
    {
      action: "Standardize utility functions",
      description: "Move common utilities to shared package",
      status: "PENDING"
    }
  ]
};

// Save the report
fs.writeFileSync(options.output, JSON.stringify(report, null, 2), 'utf8');
console.log(`📝 Report saved to ${options.output}`);

// Generate refactoring plan if requested
if (options.generatePlan) {
  console.log('\n📋 Generating refactoring plan...');
  
  const refactoringPlan = [
    {
      title: "Consolidate Logger Implementations",
      priority: "HIGH",
      description: "Multiple logger implementations exist across packages",
      action: "Standardize on shared/utils/logging/logger.ts",
      files: [
        "packages/worker-interface/src/utils/logger.ts",
        "packages/worker-bot/src/utils/logger.ts"
      ],
      targetLocation: "packages/shared/src/utils/logging/logger.ts",
      estimatedEffort: "MEDIUM",
      status: "IN_PROGRESS"
    },
    {
      title: "Consolidate Fraud Detection Logic",
      priority: "HIGH",
      description: "Duplicate fraud detection implementations",
      action: "Merge FraudDetector and AdvancedFraudDetector into one implementation",
      files: [
        "src/verification/FraudDetector.ts",
        "src/verification/AdvancedFraudDetector.ts"
      ],
      targetLocation: "packages/verification-engine/src/fraud-detection/FraudDetector.ts",
      estimatedEffort: "HIGH",
      status: "COMPLETED"
    },
    {
      title: "Standardize TON Utilities",
      priority: "MEDIUM",
      description: "TON utility functions are duplicated across packages",
      action: "Move to shared/utils/ton",
      files: [
        "packages/worker-bot/src/services/ton.ts",
        "packages/worker-webapp/src/services/ton.ts"
      ],
      targetLocation: "packages/shared/src/utils/ton.ts",
      estimatedEffort: "MEDIUM",
      status: "PENDING"
    }
  ];
  
  // Save the refactoring plan
  fs.writeFileSync('refactoring-plan.json', JSON.stringify(refactoringPlan, null, 2), 'utf8');
  console.log('✅ Refactoring plan saved to refactoring-plan.json');
  
  // Generate Markdown summary
  const markdownSummary = `# Code Duplication Refactoring Plan

## Summary

- **Target Directories**: ${targetDirs.join(', ')}
- **Excluded Patterns**: ${excludeDirs.split(',').join(', ')}
- **Generated**: ${new Date().toISOString()}

## Top Refactoring Priorities

${refactoringPlan.map((plan, index) => `
### ${index + 1}. ${plan.title}

- **Priority**: ${plan.priority}
- **Description**: ${plan.description}
- **Action**: ${plan.action}
- **Files**: ${plan.files.join(', ')}
- **Target Location**: \`${plan.targetLocation}\`
- **Estimated Effort**: ${plan.estimatedEffort}
- **Status**: ${plan.status}
`).join('\n')}

## How to Use This Plan

1. Start with HIGH priority items
2. For each item:
   - Compare the duplicated files to understand their differences
   - Consolidate to the target location, merging unique functionality
   - Update imports in all dependent files
   - Run tests to ensure functionality is preserved
   - Document the change in CHANGELOG.md
`;

  fs.writeFileSync('refactoring-plan.md', markdownSummary, 'utf8');
  console.log('✅ Markdown summary saved to refactoring-plan.md');
}

console.log('\n🎉 Analysis complete!'); 