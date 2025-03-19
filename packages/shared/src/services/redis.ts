import { createClient, RedisClientType } from 'redis';
import { ILogger } from './ton';

export interface RedisCacheOptions {
  url: string;
  defaultTtl?: number;
  prefixKey?: string;
  logger?: ILogger;
}

export class RedisCache {
  private client: RedisClientType;
  private defaultTtl: number;
  private prefixKey: string;
  private logger: ILogger;
  private isConnected: boolean = false;

  constructor(options: RedisCacheOptions) {
    const { url, defaultTtl = 3600, prefixKey = 'aletheia:', logger = console } = options;

    this.client = createClient({ url });
    this.defaultTtl = defaultTtl;
    this.prefixKey = prefixKey;
    this.logger = logger;

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error('Redis Client Error', { error: err });
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.info('Redis Client Connected');
    });
  }

  /**
   * Connect to Redis if not already connected
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        this.logger.error('Failed to connect to Redis', { error });
        throw error;
      }
    }
  }

  /**
   * Get key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefixKey}${key}`;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.connect();
    
    try {
      const serializedValue = JSON.stringify(value);
      const finalTtl = ttl || this.defaultTtl;
      
      await this.client.set(this.getKey(key), serializedValue, { EX: finalTtl });
    } catch (error) {
      this.logger.error('Error setting cache value', { error, key });
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    
    try {
      const value = await this.client.get(this.getKey(key));
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Error getting cache value', { error, key });
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    await this.connect();
    
    try {
      await this.client.del(this.getKey(key));
    } catch (error) {
      this.logger.error('Error deleting cache value', { error, key });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    await this.connect();
    
    try {
      const exists = await this.client.exists(this.getKey(key));
      return exists === 1;
    } catch (error) {
      this.logger.error('Error checking if key exists', { error, key });
      return false;
    }
  }

  /**
   * Set a value in cache only if it doesn't already exist
   */
  async setNX<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    await this.connect();
    
    try {
      const serializedValue = JSON.stringify(value);
      const finalTtl = ttl || this.defaultTtl;
      
      const result = await this.client.setNX(this.getKey(key), serializedValue);
      
      if (result) {
        await this.client.expire(this.getKey(key), finalTtl);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error setting cache value with NX', { error, key });
      return false;
    }
  }

  /**
   * Get or set a value using a factory function if not in cache
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cachedValue = await this.get<T>(key);
    
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
      } catch (error) {
        this.logger.error('Error closing Redis connection', { error });
      }
    }
  }
}

/**
 * Create a Redis cache service
 */
export function createRedisCache(options: RedisCacheOptions): RedisCache {
  return new RedisCache(options);
} 