import { z } from 'zod';
import merge from 'deepmerge';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type ConfigValidator<T> = (config: Partial<T>) => T;

export interface ConfigValidatorOptions<T> {
  schema: z.ZodType<T>;
  defaultConfig: T;
  transformers?: Array<(config: Partial<T>) => Partial<T>>;
  validators?: Array<(config: T) => ValidationResult>;
}

export function createConfigValidator<T>({
  schema,
  defaultConfig,
  transformers = [],
  validators = []
}: ConfigValidatorOptions<T>): ConfigValidator<T> {
  return (partialConfig: Partial<T>): T => {
    // Apply transformers in sequence
    const transformedConfig = transformers.reduce(
      (config, transform) => transform(config),
      partialConfig
    );

    // Merge with default config
    const mergedConfig = merge(defaultConfig, transformedConfig, {
      arrayMerge: (target, source) => source // Replace arrays instead of concatenating
    });

    // Validate against schema
    const validatedConfig = schema.parse(mergedConfig);

    // Run custom validators
    const validationResults = validators.map(validate => validate(validatedConfig));
    const errors = validationResults.flatMap(result => result.errors);
    const warnings = validationResults.flatMap(result => result.warnings);

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    if (warnings.length > 0) {
      console.warn(`Configuration warnings:\n${warnings.join('\n')}`);
    }

    return validatedConfig;
  };
}

export function createEnvironmentTransformer<T>(envMap: Record<keyof T, string>): (config: Partial<T>) => Partial<T> {
  return (config: Partial<T>) => {
    const envConfig: Partial<T> = {} as Partial<T>;

    for (const [key, envVar] of Object.entries(envMap)) {
      if (process.env[envVar] !== undefined) {
        (envConfig as any)[key] = process.env[envVar];
      }
    }

    return merge(config, envConfig);
  };
}

export function createSecurityValidator<T>(sensitiveFields: Array<keyof T>) {
  return (config: T): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of sensitiveFields) {
      if ((config as any)[field]) {
        if (typeof (config as any)[field] === 'string' && (config as any)[field].includes('Bearer ')) {
          errors.push(`Security violation: ${String(field)} contains authorization token`);
        }
        if (typeof (config as any)[field] === 'string' && (config as any)[field].match(/[A-Z0-9]{20,}/)) {
          warnings.push(`Potential security risk: ${String(field)} may contain an API key`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };
}

export function createPerformanceValidator<T>(thresholds: Partial<Record<keyof T, number>>) {
  return (config: T): ValidationResult => {
    const warnings: string[] = [];

    for (const [key, threshold] of Object.entries(thresholds)) {
      const value = (config as any)[key];
      if (typeof value === 'number' && value > threshold) {
        warnings.push(`Performance warning: ${key} (${value}) exceeds recommended threshold (${threshold})`);
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings
    };
  };
} 