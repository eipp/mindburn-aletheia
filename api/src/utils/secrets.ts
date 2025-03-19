import { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  DescribeSecretCommand
} from '@aws-sdk/client-secrets-manager';
import { createLogger } from '@mindburn/shared/src/utils/logging/logger';

const logger = createLogger({ service: 'SecretsManager' });
const secretsClient = new SecretsManagerClient({});

// Cache for secrets to minimize API calls
interface SecretCache {
  [key: string]: {
    value: string;
    expiresAt: number;
    version: string;
  }
}

const secretsCache: SecretCache = {};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache TTL

/**
 * Fetches a secret from AWS Secrets Manager with caching
 * 
 * @param secretId The name or ARN of the secret
 * @param forceRefresh Force refresh the secret value from AWS (bypass cache)
 * @returns The secret string value
 */
export async function getSecretValue(secretId: string, forceRefresh = false): Promise<string> {
  const now = Date.now();
  const cachedSecret = secretsCache[secretId];
  
  // Return cached secret if it's still valid and no force refresh
  if (!forceRefresh && cachedSecret && cachedSecret.expiresAt > now) {
    logger.debug('Using cached secret', { secretId });
    return cachedSecret.value;
  }
  
  try {
    // Check if the secret version has changed
    const describeResponse = await secretsClient.send(
      new DescribeSecretCommand({ SecretId: secretId })
    );
    
    const currentVersion = describeResponse.VersionId;
    
    // If cached version matches current version, extend cache TTL and return
    if (
      !forceRefresh && 
      cachedSecret && 
      currentVersion && 
      cachedSecret.version === currentVersion
    ) {
      secretsCache[secretId] = {
        ...cachedSecret,
        expiresAt: now + CACHE_TTL_MS
      };
      logger.debug('Extended secret cache TTL', { secretId });
      return cachedSecret.value;
    }
    
    // Fetch the secret value
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretId })
    );
    
    if (!response.SecretString) {
      throw new Error(`Secret ${secretId} does not contain a string value`);
    }
    
    // Cache the secret
    secretsCache[secretId] = {
      value: response.SecretString,
      expiresAt: now + CACHE_TTL_MS,
      version: response.VersionId || 'unknown'
    };
    
    logger.info('Secret fetched and cached', { 
      secretId,
      versionId: response.VersionId,
      cacheExpiresIn: '15 minutes'
    });
    
    return response.SecretString;
  } catch (error) {
    logger.error('Error fetching secret', { secretId, error });
    
    // Return cached version if available, even if expired
    if (cachedSecret) {
      logger.warn('Using expired cached secret due to fetch error', { secretId });
      return cachedSecret.value;
    }
    
    throw new Error(`Failed to retrieve secret ${secretId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Force refresh all cached secrets
 */
export async function refreshSecrets(): Promise<void> {
  const secretIds = Object.keys(secretsCache);
  
  logger.info('Refreshing all cached secrets', { count: secretIds.length });
  
  for (const secretId of secretIds) {
    try {
      await getSecretValue(secretId, true);
      logger.debug('Refreshed secret', { secretId });
    } catch (error) {
      logger.error('Failed to refresh secret', { secretId, error });
    }
  }
}

/**
 * Clears the secrets cache
 */
export function clearSecretsCache(): void {
  Object.keys(secretsCache).forEach(key => delete secretsCache[key]);
  logger.info('Secrets cache cleared');
} 