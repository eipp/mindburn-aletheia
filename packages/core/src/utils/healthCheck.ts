import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { 
  createTonService, 
  TonService, 
  createLogger, 
  ILogger 
} from '@mindburn/shared';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      latency?: number;
    };
    tonNetwork?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      latency?: number;
      network?: string;
    };
  };
  details?: Record<string, any>;
}

export interface HealthCheckOptions {
  dynamoDbConfig?: {
    client: DynamoDBClient;
    tableName: string;
    region: string;
  };
  tonConfig?: {
    service: TonService;
    endpoint: string;
    network: 'mainnet' | 'testnet';
  };
  timeout?: number;
  logger?: ILogger;
}

export class HealthChecker {
  private dynamoDbClient: DynamoDBClient | null = null;
  private tableName: string | null = null;
  private tonService: TonService | null = null;
  private timeout: number;
  private logger: ILogger;
  private version: string;

  constructor(options: HealthCheckOptions, version: string) {
    this.dynamoDbClient = options.dynamoDbConfig?.client || null;
    this.tableName = options.dynamoDbConfig?.tableName || null;
    this.tonService = options.tonConfig?.service || null;
    this.timeout = options.timeout || 5000; // Default timeout 5 seconds
    this.logger = options.logger || createLogger({ service: 'health-checker' });
    this.version = version;
  }

  /**
   * Check the health of all services
   */
  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const healthStatus: HealthStatus = {
      status: 'healthy',
      version: this.version,
      timestamp,
      services: {},
    };

    try {
      // Run checks in parallel
      const [dbStatus, tonStatus] = await Promise.all([
        this.checkDatabase(),
        this.checkTonNetwork(),
      ]);

      // Combine results
      healthStatus.services.database = dbStatus;
      healthStatus.services.tonNetwork = tonStatus;

      // Determine overall status
      if (dbStatus.status === 'unhealthy' || tonStatus.status === 'unhealthy') {
        healthStatus.status = 'unhealthy';
      } else if (dbStatus.status === 'degraded' || tonStatus.status === 'degraded') {
        healthStatus.status = 'degraded';
      }

      return healthStatus;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        version: this.version,
        timestamp,
        services: {},
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check the database status
   */
  private async checkDatabase(): Promise<HealthStatus['services']['database']> {
    if (!this.dynamoDbClient || !this.tableName) {
      return {
        status: 'unhealthy',
        message: 'DynamoDB client or table name not configured',
      };
    }

    try {
      const startTime = Date.now();
      
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database check timed out')), this.timeout);
      });

      // Create the actual check promise
      const checkPromise = this.dynamoDbClient.send(
        new DescribeTableCommand({ TableName: this.tableName })
      );

      // Race the promises
      await Promise.race([checkPromise, timeoutPromise]);
      
      const latency = Date.now() - startTime;
      
      // Check if latency is within acceptable range
      if (latency > 1000) {
        return {
          status: 'degraded',
          message: 'Database response time is high',
          latency,
        };
      }

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      this.logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check the TON network status
   */
  private async checkTonNetwork(): Promise<HealthStatus['services']['tonNetwork']> {
    if (!this.tonService) {
      return {
        status: 'unhealthy',
        message: 'TON service not configured',
      };
    }

    try {
      const startTime = Date.now();
      
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TON network check timed out')), this.timeout);
      });

      // Get a well-known address balance as a simple health check
      // Using the TON Foundation address for mainnet or a testnet address
      const checkAddress = 'EQCkR1cGmnsE45N4K0otPl5EnxnRakmGqeJUNua5fkWhales';
      
      // Create the actual check promise
      const checkPromise = this.tonService.getBalance(checkAddress);

      // Race the promises
      await Promise.race([checkPromise, timeoutPromise]);
      
      const latency = Date.now() - startTime;
      
      // Check if latency is within acceptable range
      if (latency > 2000) {
        return {
          status: 'degraded',
          message: 'TON network response time is high',
          latency,
          network: this.tonService['networkConfig']?.network,
        };
      }

      return {
        status: 'healthy',
        latency,
        network: this.tonService['networkConfig']?.network,
      };
    } catch (error) {
      this.logger.error('TON network health check failed', { error });
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown TON network error',
      };
    }
  }
} 