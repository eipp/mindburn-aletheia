import { DynamoDB } from 'aws-sdk';
import { CacheConfig } from './types';
import { createHash } from 'crypto';

export class Cache {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly tableName = 'VerificationCache';

  constructor(private config: CacheConfig) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async get(data: any): Promise<any | null> {
    if (!this.config.enabled) return null;

    const hash = this.generateHash(data);
    const similarityKey = this.generateSimilarityKey(data);

    try {
      // Try exact match first
      const exactResult = await this.dynamodb
        .get({
          TableName: this.tableName,
          Key: { hash },
        })
        .promise();

      if (exactResult.Item) {
        return this.validateCacheEntry(exactResult.Item);
      }

      // Try similarity-based match
      if (this.config.similarityThreshold > 0) {
        const similarResults = await this.dynamodb
          .query({
            TableName: this.tableName,
            IndexName: 'SimilarityIndex',
            KeyConditionExpression: 'similarityKey = :key',
            ExpressionAttributeValues: {
              ':key': similarityKey,
            },
          })
          .promise();

        if (similarResults.Items?.length) {
          const bestMatch = this.findBestMatch(data, similarResults.Items);
          if (
            bestMatch &&
            this.calculateSimilarity(data, bestMatch.data) >= this.config.similarityThreshold
          ) {
            return this.validateCacheEntry(bestMatch);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  async set(data: any, result: any): Promise<void> {
    if (!this.config.enabled) return;

    const hash = this.generateHash(data);
    const similarityKey = this.generateSimilarityKey(data);
    const timestamp = Date.now();
    const ttl = Math.floor(timestamp / 1000) + this.config.ttlSeconds;

    const cacheEntry = {
      hash,
      similarityKey,
      data,
      result,
      timestamp,
      ttl,
    };

    try {
      await this.dynamodb
        .put({
          TableName: this.tableName,
          Item: cacheEntry,
          ConditionExpression: 'attribute_not_exists(hash) OR #ts < :oldTimestamp',
          ExpressionAttributeNames: {
            '#ts': 'timestamp',
          },
          ExpressionAttributeValues: {
            ':oldTimestamp': timestamp - this.config.ttlSeconds * 1000,
          },
        })
        .promise();

      // Cleanup old entries if cache size exceeds limit
      await this.enforceMaxSize();
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  private generateHash(data: any): string {
    return createHash('sha256')
      .update(JSON.stringify(this.normalizeData(data)))
      .digest('hex');
  }

  private generateSimilarityKey(data: any): string {
    // Generate a less strict key for similarity matching
    // This could be based on task type, content length, key features, etc.
    const normalized = this.normalizeData(data);
    return createHash('sha256')
      .update(
        JSON.stringify({
          type: normalized.type,
          length: JSON.stringify(normalized).length,
          features: this.extractKeyFeatures(normalized),
        })
      )
      .digest('hex');
  }

  private normalizeData(data: any): any {
    // Normalize data by removing irrelevant fields, standardizing format, etc.
    return {
      ...data,
      timestamp: undefined,
      id: undefined,
    };
  }

  private extractKeyFeatures(data: any): any {
    // Extract key features for similarity matching
    // This should be customized based on your data structure
    return {
      contentType: data.type,
      contentLength: JSON.stringify(data).length,
      // Add more relevant features
    };
  }

  private calculateSimilarity(data1: any, data2: any): number {
    // Implement similarity calculation logic
    // This is a simplified example using JSON similarity
    const str1 = JSON.stringify(this.normalizeData(data1));
    const str2 = JSON.stringify(this.normalizeData(data2));

    let similarity = 0;
    const len = Math.min(str1.length, str2.length);

    for (let i = 0; i < len; i++) {
      if (str1[i] === str2[i]) similarity++;
    }

    return similarity / Math.max(str1.length, str2.length);
  }

  private findBestMatch(data: any, candidates: any[]): any | null {
    let bestMatch = null;
    let highestSimilarity = 0;

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(data, candidate.data);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  private validateCacheEntry(entry: any): any | null {
    const now = Math.floor(Date.now() / 1000);
    if (entry.ttl && entry.ttl < now) {
      return null;
    }
    return entry.result;
  }

  private async enforceMaxSize(): Promise<void> {
    if (!this.config.maxSize) return;

    try {
      const result = await this.dynamodb
        .scan({
          TableName: this.tableName,
          Select: 'COUNT',
        })
        .promise();

      if (result.Count && result.Count > this.config.maxSize) {
        const itemsToRemove = result.Count - this.config.maxSize;

        // Get oldest items
        const oldItems = await this.dynamodb
          .scan({
            TableName: this.tableName,
            Limit: itemsToRemove,
            ProjectionExpression: 'hash',
            FilterExpression: '#ts < :threshold',
            ExpressionAttributeNames: {
              '#ts': 'timestamp',
            },
            ExpressionAttributeValues: {
              ':threshold': Date.now() - this.config.ttlSeconds * 1000,
            },
          })
          .promise();

        // Delete oldest items
        if (oldItems.Items) {
          const deletePromises = oldItems.Items.map(item =>
            this.dynamodb
              .delete({
                TableName: this.tableName,
                Key: { hash: item.hash },
              })
              .promise()
          );

          await Promise.all(deletePromises);
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}
