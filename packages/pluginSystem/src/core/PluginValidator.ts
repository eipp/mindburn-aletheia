import { PluginManifest } from './types';
import { PluginError, PluginErrorCodes } from '../errors/PluginError';
import { createHash } from 'crypto';
import { readFile, readdir } from 'fs/promises';
import * as path from 'path';
import { parse as parseJS } from '@babel/parser';
import traverse from '@babel/traverse';
import * as ESLint from 'eslint';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number;
}

export class PluginValidator {
  private readonly allowedDependencies = new Set([
    'lodash',
    'axios',
    'dayjs',
    'zod',
    'yup',
    'date-fns',
    'uuid',
    'validator',
    'cheerio',
    'marked',
  ]);

  private readonly bannedImports = new Set([
    'fs',
    'child_process',
    'cluster',
    'worker_threads',
    'perf_hooks',
    'v8',
    'vm',
    'sys',
  ]);

  private readonly securityRules = {
    noEval: /\beval\s*\(/,
    noFunction: /new\s+Function\s*\(/,
    noProcessEnv: /process\.env/,
    noRequire: /\brequire\s*\(/,
    noImportDynamic: /import\s*\(/,
    noGlobalThis: /\bglobalThis\b/,
  };

  async validatePlugin(pluginPath: string, manifest: PluginManifest): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityScore: 100,
    };

    try {
      await this.validateDependencies(manifest, result);
      await this.validatePermissions(manifest, result);
      await this.validateFileIntegrity(pluginPath, manifest, result);
      await this.validateSourceCode(pluginPath, result);
      await this.runSecurityScans(pluginPath, result);
      await this.validateTypeScript(pluginPath, result);
      await this.runESLint(pluginPath, result);

      result.isValid = result.errors.length === 0;
      result.securityScore = this.calculateSecurityScore(result);
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${error.message}`);
      result.securityScore = 0;
    }

    return result;
  }

  private async validateDependencies(
    manifest: PluginManifest,
    result: ValidationResult
  ): Promise<void> {
    if (!manifest.dependencies) return;

    const disallowedDeps = Object.keys(manifest.dependencies).filter(
      dep => !this.allowedDependencies.has(dep)
    );

    if (disallowedDeps.length > 0) {
      result.errors.push(`Disallowed dependencies found: ${disallowedDeps.join(', ')}`);
    }

    // Check dependency versions
    for (const [dep, version] of Object.entries(manifest.dependencies)) {
      if (version.startsWith('^') || version.startsWith('~')) {
        result.warnings.push(`Loose version specified for ${dep}. Consider using exact versions.`);
      }
    }
  }

  private async validatePermissions(
    manifest: PluginManifest,
    result: ValidationResult
  ): Promise<void> {
    const validPermissions = new Set(['network', 'storage', 'visualization', 'analytics']);

    for (const permission of manifest.permissions) {
      if (!validPermissions.has(permission)) {
        result.errors.push(`Invalid permission requested: ${permission}`);
      }
    }

    // Check for permission combinations that might be suspicious
    if (manifest.permissions.includes('network') && manifest.permissions.includes('storage')) {
      result.warnings.push(
        'Plugin requests both network and storage permissions. Ensure this is necessary.'
      );
    }
  }

  private async validateFileIntegrity(
    pluginPath: string,
    manifest: PluginManifest,
    result: ValidationResult
  ): Promise<void> {
    const files = await this.getAllFiles(pluginPath);
    const hashes = new Map<string, string>();

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      const hash = createHash('sha256').update(content).digest('hex');
      hashes.set(file, hash);
    }

    // Store hashes in result for later verification
    result.fileHashes = hashes;
  }

  private async validateSourceCode(pluginPath: string, result: ValidationResult): Promise<void> {
    const files = await this.getAllFiles(pluginPath);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const content = await readFile(file, 'utf8');

      // Check for banned patterns
      for (const [rule, pattern] of Object.entries(this.securityRules)) {
        if (pattern.test(content)) {
          result.errors.push(`Security violation in ${file}: ${rule}`);
        }
      }

      // Parse and analyze AST
      try {
        const ast = parseJS(content, {
          sourceType: 'module',
          plugins: ['typescript'],
        });

        traverse(ast, {
          ImportDeclaration: path => {
            const importName = path.node.source.value;
            if (this.bannedImports.has(importName)) {
              result.errors.push(`Banned import '${importName}' found in ${file}`);
            }
          },
          CallExpression: path => {
            if (path.node.callee.type === 'Identifier') {
              const funcName = path.node.callee.name;
              if (funcName === 'setTimeout' || funcName === 'setInterval') {
                result.warnings.push(`Timer usage found in ${file}. Ensure proper cleanup.`);
              }
            }
          },
        });
      } catch (error) {
        result.errors.push(`Failed to parse ${file}: ${error.message}`);
      }
    }
  }

  private async runSecurityScans(pluginPath: string, result: ValidationResult): Promise<void> {
    // Scan for known vulnerabilities in dependencies
    try {
      const packageLockPath = path.join(pluginPath, 'package-lock.json');
      const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));

      // Add dependency vulnerability scanning logic here
      // This would typically integrate with a vulnerability database
    } catch (error) {
      result.warnings.push('Could not scan dependencies for vulnerabilities');
    }

    // Scan for sensitive data patterns
    const sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
      /\b[A-Za-z0-9]{32,}\b/, // API keys
      /\b[0-9]{16}\b/, // Credit card numbers
    ];

    const files = await this.getAllFiles(pluginPath);
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          result.warnings.push(`Possible sensitive data found in ${file}`);
        }
      }
    }
  }

  private async validateTypeScript(pluginPath: string, result: ValidationResult): Promise<void> {
    // Add TypeScript validation logic
    // This would typically use the TypeScript compiler API
  }

  private async runESLint(pluginPath: string, result: ValidationResult): Promise<void> {
    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfig: {
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/recommended',
          'plugin:security/recommended',
        ],
        plugins: ['security'],
      },
    });

    const results = await eslint.lintFiles([path.join(pluginPath, '**/*.{js,ts}')]);

    for (const lintResult of results) {
      for (const message of lintResult.messages) {
        if (message.severity === 2) {
          result.errors.push(`ESLint error in ${lintResult.filePath}: ${message.message}`);
        } else {
          result.warnings.push(`ESLint warning in ${lintResult.filePath}: ${message.message}`);
        }
      }
    }
  }

  private calculateSecurityScore(result: ValidationResult): number {
    let score = 100;

    // Deduct points for errors and warnings
    score -= result.errors.length * 10;
    score -= result.warnings.length * 5;

    // Ensure score stays within 0-100
    return Math.max(0, Math.min(100, score));
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.getAllFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
