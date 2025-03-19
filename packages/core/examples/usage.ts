/**
 * Example usage of the enhanced @mindburn/core package
 */
import { 
  initializeCore, 
  healthCheck, 
  validateCoreConfig, 
  HealthEventType,
  SystemEventType
} from '../src';
import { createEnvironmentTransformer } from '@mindburn/shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

async function main() {
  console.log('Starting Mindburn Aletheia Core Example');

  try {
    // 1. Load and validate configuration
    // In a real application, this would be loaded from environment variables
    const config = validateCoreConfig({
      app: {
        name: 'mindburn-example',
        version: '0.1.0',
        environment: 'development',
      },
      aws: {
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'fake-access-key',
          secretAccessKey: 'fake-secret-key',
        },
        dynamodb: {
          tablePrefix: 'mindburn-dev-',
          healthCheckTable: 'health-check',
        },
      },
      ton: {
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        network: 'testnet',
      },
      logging: {
        level: 'info',
        cloudWatch: {
          enabled: false,
          logGroupName: '/mindburn/aletheia/example',
          logStreamName: 'core',
        },
      },
      health: {
        checkInterval: 60000, // 1 minute
        timeout: 5000, // 5 seconds
      },
    });

    // 2. Initialize core services
    const orchestrator = initializeCore(config);

    // 3. Register event handlers
    orchestrator.on(HealthEventType.STATUS_CHANGED, (statusChange) => {
      console.log(`Health status changed: ${statusChange.previous} -> ${statusChange.current}`);
    });

    orchestrator.on(HealthEventType.DEGRADED, (status) => {
      console.log('System health degraded:', status);
    });

    orchestrator.on(SystemEventType.ERROR, (error) => {
      console.error('System error:', error);
    });

    // 4. Access services from the orchestrator
    const dynamoDbService = orchestrator.getDynamoDBService();
    const tonService = orchestrator.getTonService();

    // 5. Execute logic with injected services
    await orchestrator.executeWithServices(async (services) => {
      // Access all registered services
      const { logger } = services;
      
      logger.info('Example task started');
      
      // Direct service usage example
      await dynamoDbService.getTask('example-task-id');
      
      // Wait for 2 seconds to simulate work
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      logger.info('Example task completed');
    });

    // 6. Perform a manual health check
    const status = await healthCheck({
      dynamoDbClient: new DynamoDBClient({
        region: config.aws.region,
        credentials: config.aws.credentials,
      }),
      tableName: `${config.aws.dynamodb.tablePrefix}${config.aws.dynamodb.healthCheckTable}`,
      tonEndpoint: config.ton.endpoint,
      tonNetwork: config.ton.network,
    });

    console.log('Health check result:', JSON.stringify(status, null, 2));

    // 7. Clean shutdown
    console.log('Shutting down...');
    await orchestrator.shutdown();
    
    console.log('Example completed successfully');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 