#!/usr/bin/env node

/**
 * Codebase Analysis Script
 * 
 * This script analyzes the codebase structure to identify:
 * 1. Inconsistent naming conventions
 * 2. Duplicate or overlapping directories
 * 3. Multiple configuration files
 * 4. Unorganized scripts
 * 5. Unnecessary files in version control
 * 
 * Usage:
 *   node scripts/refactoring/analyze-codebase.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo'
];

const IGNORE_FILES = [
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.env',
  '.env.local'
];

const NAMING_CONVENTIONS = {
  KEBAB_CASE: 'kebab-case',
  CAMEL_CASE: 'camelCase',
  PASCAL_CASE: 'PascalCase',
  SNAKE_CASE: 'snake_case'
};

// Output directory
const OUTPUT_DIR = path.resolve('docs/analysis');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Results
const results = {
  namingConventions: {
    kebabCase: [],
    camelCase: [],
    pascalCase: [],
    snakeCase: [],
    mixed: []
  },
  potentialDuplicates: [],
  configFiles: [],
  scripts: [],
  unnecessaryFiles: [],
  directoryStructure: {}
};

/**
 * Detect naming convention of a string
 */
function detectNamingConvention(str) {
  // Remove file extension
  const name = path.basename(str, path.extname(str));
  
  if (name.includes('-')) return NAMING_CONVENTIONS.KEBAB_CASE;
  if (name.includes('_')) return NAMING_CONVENTIONS.SNAKE_CASE;
  if (name[0] === name[0].toUpperCase() && !name.includes(' ')) return NAMING_CONVENTIONS.PASCAL_CASE;
  if (name[0] === name[0].toLowerCase() && !name.includes(' ') && !name.includes('-') && !name.includes('_')) return NAMING_CONVENTIONS.CAMEL_CASE;
  
  return 'mixed';
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir, relativePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const structure = { files: [], directories: {} };
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const entryRelativePath = path.join(relativePath, entry.name);
    
    if (IGNORE_DIRS.includes(entry.name)) continue;
    
    if (entry.isDirectory()) {
      structure.directories[entry.name] = scanDirectory(entryPath, entryRelativePath);
      
      // Check for potential duplicate directories
      if (entry.name.includes('test') || entry.name.includes('verification') || 
          entry.name.includes('utils') || entry.name.includes('config')) {
        results.potentialDuplicates.push({
          name: entry.name,
          path: entryRelativePath
        });
      }
    } else if (entry.isFile()) {
      if (IGNORE_FILES.includes(entry.name)) {
        results.unnecessaryFiles.push(entryRelativePath);
        continue;
      }
      
      structure.files.push(entry.name);
      
      // Check naming convention
      const convention = detectNamingConvention(entry.name);
      switch (convention) {
        case NAMING_CONVENTIONS.KEBAB_CASE:
          results.namingConventions.kebabCase.push(entryRelativePath);
          break;
        case NAMING_CONVENTIONS.CAMEL_CASE:
          results.namingConventions.camelCase.push(entryRelativePath);
          break;
        case NAMING_CONVENTIONS.PASCAL_CASE:
          results.namingConventions.pascalCase.push(entryRelativePath);
          break;
        case NAMING_CONVENTIONS.SNAKE_CASE:
          results.namingConventions.snakeCase.push(entryRelativePath);
          break;
        default:
          results.namingConventions.mixed.push(entryRelativePath);
      }
      
      // Check for config files
      if (entry.name.includes('config') || entry.name.endsWith('.config.js') || 
          entry.name === 'tsconfig.json' || entry.name === '.eslintrc.js' ||
          entry.name === '.prettierrc') {
        results.configFiles.push(entryRelativePath);
      }
      
      // Check for script files
      if (entryRelativePath.startsWith('scripts/') || 
          (entry.name.endsWith('.js') && entry.name.includes('script'))) {
        results.scripts.push(entryRelativePath);
      }
    }
  }
  
  return structure;
}

/**
 * Find potential duplicate functionality
 */
function findPotentialDuplicates() {
  // Look for similar directory names across the codebase
  const dirMap = {};
  
  results.potentialDuplicates.forEach(dir => {
    const baseName = dir.name.toLowerCase();
    if (!dirMap[baseName]) {
      dirMap[baseName] = [];
    }
    dirMap[baseName].push(dir.path);
  });
  
  // Filter to only include directories with potential duplicates
  const filteredDuplicates = Object.entries(dirMap)
    .filter(([_, paths]) => paths.length > 1)
    .map(([name, paths]) => ({ name, paths }));
  
  return filteredDuplicates;
}

/**
 * Generate report
 */
function generateReport() {
  // Calculate statistics
  const stats = {
    totalFiles: Object.values(results.namingConventions).flat().length,
    namingConventions: {
      kebabCase: results.namingConventions.kebabCase.length,
      camelCase: results.namingConventions.camelCase.length,
      pascalCase: results.namingConventions.pascalCase.length,
      snakeCase: results.namingConventions.snakeCase.length,
      mixed: results.namingConventions.mixed.length
    },
    potentialDuplicates: findPotentialDuplicates(),
    configFiles: results.configFiles.length,
    scripts: results.scripts.length,
    unnecessaryFiles: results.unnecessaryFiles.length
  };
  
  // Determine dominant naming convention
  const dominantConvention = Object.entries(stats.namingConventions)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    dominantNamingConvention: dominantConvention,
    potentialDuplicates: stats.potentialDuplicates,
    configFiles: results.configFiles,
    scripts: results.scripts,
    unnecessaryFiles: results.unnecessaryFiles,
    recommendations: {
      namingConvention: `Standardize on ${dominantConvention} for consistency`,
      potentialDuplicates: stats.potentialDuplicates.map(dup => 
        `Consider consolidating ${dup.name} directories: ${dup.paths.join(', ')}`
      ),
      configFiles: results.configFiles.length > 5 ? 
        'Consider centralizing configuration files' : 
        'Configuration files look reasonable',
      scripts: results.scripts.length > 0 ?
        'Organize scripts into subdirectories by purpose' :
        'No scripts found',
      unnecessaryFiles: results.unnecessaryFiles.length > 0 ?
        'Add the following files to .gitignore: ' + results.unnecessaryFiles.join(', ') :
        'No unnecessary files found'
    }
  };
  
  // Write report to file
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'codebase-analysis.json'), 
    JSON.stringify(report, null, 2)
  );
  
  // Generate markdown summary
  const markdownSummary = `# Codebase Analysis Report

## Summary

- **Timestamp:** ${report.timestamp}
- **Total Files Analyzed:** ${stats.totalFiles}
- **Dominant Naming Convention:** ${dominantConvention} (${stats.namingConventions[dominantConvention]} files)

## Naming Conventions

- Kebab Case: ${stats.namingConventions.kebabCase} files
- Camel Case: ${stats.namingConventions.camelCase} files
- Pascal Case: ${stats.namingConventions.pascalCase} files
- Snake Case: ${stats.namingConventions.snakeCase} files
- Mixed: ${stats.namingConventions.mixed} files

## Potential Duplicates

${stats.potentialDuplicates.length === 0 ? 'No potential duplicates found.' : 
  stats.potentialDuplicates.map(dup => `- **${dup.name}**: Found in ${dup.paths.length} locations\n  - ${dup.paths.join('\n  - ')}`).join('\n\n')}

## Configuration Files

${results.configFiles.length === 0 ? 'No configuration files found.' : results.configFiles.map(file => `- ${file}`).join('\n')}

## Scripts

${results.scripts.length === 0 ? 'No scripts found.' : results.scripts.map(script => `- ${script}`).join('\n')}

## Unnecessary Files

${results.unnecessaryFiles.length === 0 ? 'No unnecessary files found.' : results.unnecessaryFiles.map(file => `- ${file}`).join('\n')}

## Recommendations

1. **Naming Convention:** ${report.recommendations.namingConvention}
${stats.potentialDuplicates.length > 0 ? '2. **Potential Duplicates:**\n' + stats.potentialDuplicates.map(dup => `   - Consider consolidating \`${dup.name}\` directories`).join('\n') : ''}
${results.configFiles.length > 5 ? '3. **Configuration Files:** Consider centralizing configuration files' : ''}
${results.scripts.length > 0 ? '4. **Scripts:** Organize scripts into subdirectories by purpose' : ''}
${results.unnecessaryFiles.length > 0 ? '5. **Unnecessary Files:** Update .gitignore to exclude unnecessary files' : ''}

## Next Steps

1. Create a standardized naming convention guide
2. Consolidate duplicate directories
3. Centralize configuration where possible
4. Organize scripts by purpose
5. Update .gitignore file
`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'codebase-analysis.md'), 
    markdownSummary
  );
  
  return report;
}

// Main execution
console.log('📊 Analyzing codebase structure...');
results.directoryStructure = scanDirectory(path.resolve('.'));
const report = generateReport();

console.log(`✅ Analysis complete! Report saved to ${path.join(OUTPUT_DIR, 'codebase-analysis.md')}`);
console.log('\nSummary:');
console.log(`- Total Files: ${report.stats.totalFiles}`);
console.log(`- Dominant Naming Convention: ${report.dominantNamingConvention}`);
console.log(`- Potential Duplicates: ${report.potentialDuplicates.length}`);
console.log(`- Configuration Files: ${report.stats.configFiles}`);
console.log(`- Scripts: ${report.stats.scripts}`);
console.log(`- Unnecessary Files: ${report.stats.unnecessaryFiles}`); 