import { DynamoDB, S3 } from 'aws-sdk';
import { z } from 'zod';
import * as semver from 'semver';

const ModelMetadataSchema = z.object({
  modelId: z.string(),
  version: z.string(), // Semantic version
  name: z.string(),
  type: z.enum(['text', 'image', 'multimodal']),
  provider: z.enum(['claude', 'gemini', 'perplexity', 'custom']),
  status: z.enum(['development', 'staging', 'production', 'retired']),
  trainingData: z.object({
    dataset: z.string(),
    version: z.string(),
    size: z.number(),
    lastUpdated: z.string(),
  }),
  performance: z.object({
    accuracy: z.number(),
    confidence: z.number(),
    latency: z.number(),
    lastEvaluated: z.string(),
  }),
  governance: z.object({
    owner: z.string(),
    approvers: z.array(z.string()),
    lastAudit: z.string().optional(),
    complianceStatus: z.enum(['compliant', 'pending_review', 'non_compliant']),
    riskLevel: z.enum(['low', 'medium', 'high']),
  }),
  changelog: z.array(z.object({
    version: z.string(),
    date: z.string(),
    author: z.string(),
    changes: z.array(z.string()),
    type: z.enum(['major', 'minor', 'patch']),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class ModelRegistry {
  private dynamodb: DynamoDB.DocumentClient;
  private s3: S3;
  private readonly tableName: string;
  private readonly bucketName: string;

  constructor(config: {
    tableName: string;
    bucketName: string;
    region: string;
  }) {
    this.tableName = config.tableName;
    this.bucketName = config.bucketName;
    this.dynamodb = new DynamoDB.DocumentClient({ region: config.region });
    this.s3 = new S3({ region: config.region });
  }

  async registerModel(metadata: z.infer<typeof ModelMetadataSchema>): Promise<void> {
    ModelMetadataSchema.parse(metadata);

    // Validate semantic version
    if (!semver.valid(metadata.version)) {
      throw new Error(`Invalid semantic version: ${metadata.version}`);
    }

    // Store model metadata
    await this.dynamodb.put({
      TableName: this.tableName,
      Item: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(modelId) OR version <> :version',
      ExpressionAttributeValues: {
        ':version': metadata.version,
      },
    }).promise();

    // Log model registration
    await this.logModelEvent({
      modelId: metadata.modelId,
      eventType: 'registration',
      details: {
        version: metadata.version,
        status: metadata.status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async updateModelStatus(
    modelId: string,
    version: string,
    status: 'development' | 'staging' | 'production' | 'retired',
    approver: string
  ): Promise<void> {
    const model = await this.getModel(modelId, version);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    if (!model.governance.approvers.includes(approver)) {
      throw new Error(`Unauthorized: ${approver} is not an approved reviewer`);
    }

    await this.dynamodb.update({
      TableName: this.tableName,
      Key: { modelId, version },
      UpdateExpression: 'set #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    }).promise();

    await this.logModelEvent({
      modelId,
      eventType: 'status_change',
      details: {
        version,
        oldStatus: model.status,
        newStatus: status,
        approver,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async updatePerformanceMetrics(
    modelId: string,
    version: string,
    metrics: {
      accuracy: number;
      confidence: number;
      latency: number;
    }
  ): Promise<void> {
    const model = await this.getModel(modelId, version);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    const updatedPerformance = {
      ...model.performance,
      ...metrics,
      lastEvaluated: new Date().toISOString(),
    };

    await this.dynamodb.update({
      TableName: this.tableName,
      Key: { modelId, version },
      UpdateExpression: 'set performance = :performance, updatedAt = :now',
      ExpressionAttributeValues: {
        ':performance': updatedPerformance,
        ':now': new Date().toISOString(),
      },
    }).promise();

    await this.logModelEvent({
      modelId,
      eventType: 'performance_update',
      details: {
        version,
        metrics,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async addChangelogEntry(
    modelId: string,
    version: string,
    entry: {
      author: string;
      changes: string[];
      type: 'major' | 'minor' | 'patch';
    }
  ): Promise<void> {
    const model = await this.getModel(modelId, version);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    const changelogEntry = {
      ...entry,
      version,
      date: new Date().toISOString(),
    };

    await this.dynamodb.update({
      TableName: this.tableName,
      Key: { modelId, version },
      UpdateExpression: 'set changelog = list_append(changelog, :entry), updatedAt = :now',
      ExpressionAttributeValues: {
        ':entry': [changelogEntry],
        ':now': new Date().toISOString(),
      },
    }).promise();
  }

  async conductAudit(
    modelId: string,
    version: string,
    audit: {
      auditor: string;
      findings: string[];
      complianceStatus: 'compliant' | 'pending_review' | 'non_compliant';
      riskAssessment: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
      };
    }
  ): Promise<void> {
    const model = await this.getModel(modelId, version);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    const updatedGovernance = {
      ...model.governance,
      lastAudit: new Date().toISOString(),
      complianceStatus: audit.complianceStatus,
      riskLevel: audit.riskAssessment.level,
    };

    await this.dynamodb.update({
      TableName: this.tableName,
      Key: { modelId, version },
      UpdateExpression: 'set governance = :governance, updatedAt = :now',
      ExpressionAttributeValues: {
        ':governance': updatedGovernance,
        ':now': new Date().toISOString(),
      },
    }).promise();

    // Store detailed audit report in S3
    const auditReport = {
      ...audit,
      modelId,
      version,
      timestamp: new Date().toISOString(),
    };

    await this.s3.putObject({
      Bucket: this.bucketName,
      Key: `audits/${modelId}/${version}/${auditReport.timestamp}.json`,
      Body: JSON.stringify(auditReport, null, 2),
      ContentType: 'application/json',
    }).promise();

    await this.logModelEvent({
      modelId,
      eventType: 'audit',
      details: {
        version,
        auditor: audit.auditor,
        complianceStatus: audit.complianceStatus,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async listModelVersions(modelId: string): Promise<z.infer<typeof ModelMetadataSchema>[]> {
    const result = await this.dynamodb.query({
      TableName: this.tableName,
      KeyConditionExpression: 'modelId = :modelId',
      ExpressionAttributeValues: {
        ':modelId': modelId,
      },
    }).promise();

    return result.Items as z.infer<typeof ModelMetadataSchema>[];
  }

  private async getModel(
    modelId: string,
    version: string
  ): Promise<z.infer<typeof ModelMetadataSchema> | null> {
    const result = await this.dynamodb.get({
      TableName: this.tableName,
      Key: { modelId, version },
    }).promise();

    return result.Item as z.infer<typeof ModelMetadataSchema> || null;
  }

  private async logModelEvent(event: {
    modelId: string;
    eventType: string;
    details: Record<string, any>;
  }): Promise<void> {
    await this.dynamodb.put({
      TableName: `${this.tableName}_events`,
      Item: {
        modelId: event.modelId,
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        details: event.details,
      },
    }).promise();
  }
} 