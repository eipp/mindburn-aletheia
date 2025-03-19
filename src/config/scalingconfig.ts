import { z } from 'zod';

const LambdaConfigSchema = z.object({
  memorySize: z.number().min(128).max(10240),
  timeout: z.number().min(1).max(900),
  concurrency: z.number().min(1).max(1000),
  provisionedConcurrency: z.number().min(0),
  coldStartPrewarmCount: z.number().min(0),
  regions: z.array(z.string()),
  enableSnapStart: z.boolean(),
});

const DynamoDBConfigSchema = z.object({
  tables: z.record(
    z.object({
      readCapacityUnits: z.number().min(1),
      writeCapacityUnits: z.number().min(1),
      autoscaling: z.object({
        minCapacity: z.number().min(1),
        maxCapacity: z.number().min(1),
        targetUtilization: z.number().min(1).max(100),
      }),
      globalTables: z.array(z.string()),
      enableDAX: z.boolean(),
      daxConfig: z
        .object({
          nodeType: z.string(),
          replicationFactor: z.number().min(1),
          availabilityZones: z.array(z.string()),
        })
        .optional(),
    })
  ),
});

const ApiGatewayConfigSchema = z.object({
  stages: z.record(
    z.object({
      caching: z.object({
        enabled: z.boolean(),
        ttl: z.number().min(0),
        size: z.string(),
        dataEncrypted: z.boolean(),
      }),
      throttling: z.object({
        rateLimit: z.number().min(1),
        burstLimit: z.number().min(1),
      }),
      compression: z.boolean(),
      minimumCompressionSize: z.number().min(0),
      regions: z.array(z.string()),
    })
  ),
});

const CloudFrontConfigSchema = z.object({
  distributions: z.record(
    z.object({
      priceClass: z.enum(['PriceClass_100', 'PriceClass_200', 'PriceClass_All']),
      origins: z.array(
        z.object({
          domainName: z.string(),
          failoverCriteria: z.object({
            statusCodes: z.array(z.number()),
            failoverOrigin: z.string(),
          }),
        })
      ),
      cacheBehaviors: z.array(
        z.object({
          pathPattern: z.string(),
          ttl: z.number().min(0),
          allowedMethods: z.array(z.string()),
          cachedMethods: z.array(z.string()),
          compress: z.boolean(),
        })
      ),
      invalidationPatterns: z.array(z.string()),
    })
  ),
});

const CostProjectionSchema = z.object({
  scales: z.record(
    z.object({
      tasksPerDay: z.number(),
      estimatedCosts: z.object({
        lambda: z.number(),
        dynamodb: z.number(),
        apiGateway: z.number(),
        cloudFront: z.number(),
        total: z.number(),
      }),
    })
  ),
});

export class ScalingConfig {
  private static instance: ScalingConfig;
  private config: {
    lambda: z.infer<typeof LambdaConfigSchema>;
    dynamodb: z.infer<typeof DynamoDBConfigSchema>;
    apiGateway: z.infer<typeof ApiGatewayConfigSchema>;
    cloudFront: z.infer<typeof CloudFrontConfigSchema>;
    costProjections: z.infer<typeof CostProjectionSchema>;
  };

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): ScalingConfig {
    if (!ScalingConfig.instance) {
      ScalingConfig.instance = new ScalingConfig();
    }
    return ScalingConfig.instance;
  }

  private loadConfig(): void {
    this.config = {
      lambda: {
        memorySize: 1024,
        timeout: 30,
        concurrency: 500,
        provisionedConcurrency: 50,
        coldStartPrewarmCount: 10,
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        enableSnapStart: true,
      },
      dynamodb: {
        tables: {
          worker_activity: {
            readCapacityUnits: 100,
            writeCapacityUnits: 100,
            autoscaling: {
              minCapacity: 50,
              maxCapacity: 1000,
              targetUtilization: 70,
            },
            globalTables: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
            enableDAX: true,
            daxConfig: {
              nodeType: 'dax.r5.large',
              replicationFactor: 3,
              availabilityZones: ['a', 'b', 'c'],
            },
          },
          fraud_events: {
            readCapacityUnits: 50,
            writeCapacityUnits: 50,
            autoscaling: {
              minCapacity: 25,
              maxCapacity: 500,
              targetUtilization: 70,
            },
            globalTables: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
            enableDAX: true,
            daxConfig: {
              nodeType: 'dax.r5.large',
              replicationFactor: 3,
              availabilityZones: ['a', 'b', 'c'],
            },
          },
        },
      },
      apiGateway: {
        stages: {
          production: {
            caching: {
              enabled: true,
              ttl: 300,
              size: '1.6GB',
              dataEncrypted: true,
            },
            throttling: {
              rateLimit: 10000,
              burstLimit: 5000,
            },
            compression: true,
            minimumCompressionSize: 1024,
            regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
          },
        },
      },
      cloudFront: {
        distributions: {
          miniApp: {
            priceClass: 'PriceClass_All',
            origins: [
              {
                domainName: 'mini-app.mindburn.org',
                failoverCriteria: {
                  statusCodes: [500, 502, 503, 504],
                  failoverOrigin: 'mini-app-failover.mindburn.org',
                },
              },
            ],
            cacheBehaviors: [
              {
                pathPattern: '/static/*',
                ttl: 86400,
                allowedMethods: ['GET', 'HEAD'],
                cachedMethods: ['GET', 'HEAD'],
                compress: true,
              },
              {
                pathPattern: '/api/*',
                ttl: 0,
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
                cachedMethods: ['GET', 'HEAD'],
                compress: true,
              },
            ],
            invalidationPatterns: ['/static/*', '/api/cache/*'],
          },
        },
      },
      costProjections: {
        scales: {
          small: {
            tasksPerDay: 100000,
            estimatedCosts: {
              lambda: 150,
              dynamodb: 200,
              apiGateway: 100,
              cloudFront: 50,
              total: 500,
            },
          },
          medium: {
            tasksPerDay: 1000000,
            estimatedCosts: {
              lambda: 1200,
              dynamodb: 1500,
              apiGateway: 800,
              cloudFront: 300,
              total: 3800,
            },
          },
          large: {
            tasksPerDay: 10000000,
            estimatedCosts: {
              lambda: 10000,
              dynamodb: 12000,
              apiGateway: 6000,
              cloudFront: 2000,
              total: 30000,
            },
          },
        },
      },
    };
  }

  getLambdaConfig(): z.infer<typeof LambdaConfigSchema> {
    return this.config.lambda;
  }

  getDynamoDBConfig(): z.infer<typeof DynamoDBConfigSchema> {
    return this.config.dynamodb;
  }

  getApiGatewayConfig(): z.infer<typeof ApiGatewayConfigSchema> {
    return this.config.apiGateway;
  }

  getCloudFrontConfig(): z.infer<typeof CloudFrontConfigSchema> {
    return this.config.cloudFront;
  }

  getCostProjection(scale: 'small' | 'medium' | 'large'): any {
    return this.config.costProjections.scales[scale];
  }
}
