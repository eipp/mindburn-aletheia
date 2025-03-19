/**
 * Type checking utilities to enhance strict mode TypeScript safety
 */

import { createLogger } from './logging/logger';

const logger = createLogger('type-checking');

/**
 * Assert that a value is not null or undefined
 * Throws an error if the value is null or undefined
 *
 * @param value - Value to check
 * @param message - Optional error message
 * @returns The value, guaranteed to be non-null
 */
export function assertNonNull<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) {
    const errorMessage = message || 'Value is unexpectedly null or undefined';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * Safely access a potentially undefined property with default value
 *
 * @param obj - Object to access property from
 * @param key - Property key
 * @param defaultValue - Default value if property is undefined
 * @returns The property value or default value
 */
export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K, defaultValue: T[K]): T[K] {
  return obj && key in obj ? obj[key] : defaultValue;
}

/**
 * Ensure a value is of the expected type
 * Throws an error if the value is not of the expected type
 *
 * @param value - Value to check
 * @param predicate - Function to check if value is of expected type
 * @param typeName - Name of expected type for error message
 * @returns The value, typed as the expected type
 */
export function ensureType<T, R extends T>(
  value: T,
  predicate: (value: T) => value is R,
  typeName: string
): R {
  if (!predicate(value)) {
    const errorMessage = `Expected value to be of type ${typeName}`;
    logger.error(errorMessage, { valueType: typeof value });
    throw new TypeError(errorMessage);
  }
  return value;
}

/**
 * Type guard for checking if value is a non-empty string
 * 
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for checking if value is a valid number
 * 
 * @param value - Value to check
 * @returns True if value is a number that is not NaN or Infinity
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Convert a string to number safely
 * 
 * @param value - String value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns The converted number or default value
 */
export function safeParseInt(value: string | null | undefined, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Ensure an environment variable exists and return its value
 * Throws an error if the environment variable is not set
 * 
 * @param name - Environment variable name
 * @returns The environment variable value
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    const errorMessage = `Required environment variable ${name} is not set`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * Get environment variable with a default value
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if environment variable is not set
 * @returns The environment variable value or default value
 */
export function getEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? defaultValue : value;
}

/**
 * Validate that an object has all required properties
 * 
 * @param obj - Object to validate
 * @param requiredProps - Array of required property names
 * @returns Whether the object has all required properties
 */
export function hasRequiredProps<T>(obj: T, requiredProps: (keyof T)[]): boolean {
  return requiredProps.every(prop => 
    prop in obj && obj[prop] !== undefined && obj[prop] !== null
  );
} 