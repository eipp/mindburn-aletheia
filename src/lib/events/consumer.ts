import { Context } from 'aws-lambda';
import { AletheiaEvent } from '../../../infrastructure/src/events/schemas';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { SNS } from '@aws-sdk/client-sns';
import { z } from 'zod';
import { captureAWS } from 'aws-xray-sdk-core';

// Wrap AWS clients with X-Ray
const dynamoDB = captureAWS(new DynamoDB({
  maxAttempts: 3,
  retryMode: 'adaptive',
}));

const cloudWatch = captureAWS(new CloudWatch());
const sns = captureAWS(new SNS());

export abstract class EventConsumer<T extends AletheiaEvent> {
  protected readonly dynamoDB: DynamoDB = dynamoDB;
  protected readonly cloudWatch: CloudWatch = cloudWatch;
  protected readonly sns: SNS = sns;
  protected abstract readonly eventSchema: z.ZodType<T>;
  protected readonly processingTableName: string;
  protected readonly environment: string;
  protected readonly alertTopicArn?: string;

  constructor() {
    this.processingTableName = process.env.PROCESSED_EVENTS_TABLE || 'processed-events';
    this.environment = process.env.ENVIRONMENT || 'dev';
    this.alertTopicArn = process.env.ALERT_TOPIC_ARN;
  }

  async handler(event: any, context: Context): Promise<void> {
    const startTime = Date.now();
    let parsedEvent: T;

    try {
      parsedEvent = await this.validateAndParseEvent(event);
      
      if (await this.isEventProcessed(parsedEvent.id)) {
        console.log(`Event ${parsedEvent.id} already processed, skipping`);
        return;
      }

      await this.processEvent(parsedEvent, context);
      await this.markEventAsProcessed(parsedEvent);

      await this.recordMetrics({
        eventType: parsedEvent.type,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error) {
      const errorEvent = parsedEvent || event;
      console.error('Error processing event:', {
        error,
        event: errorEvent,
        functionName: context.functionName,
        requestId: context.awsRequestId,
      });

      await this.handleProcessingError(errorEvent, error as Error);
      await this.recordMetrics({
        eventType: errorEvent.type || 'unknown',
        duration: Date.now() - startTime,
        success: false,
      });

      throw error;
    }
  }

  protected abstract processEvent(event: T, context: Context): Promise<void>;

  private async validateAndParseEvent(event: any): Promise<T> {
    try {
      const detail = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
      return this.eventSchema.parse(detail);
    } catch (error) {
      console.error('Event validation failed:', {
        error,
        event,
        schema: this.eventSchema,
      });
      await this.sendAlert({
        subject: `[${this.environment}] Event validation failure`,
        message: `Failed to validate event: ${(error as Error).message}`,
        severity: 'HIGH',
        event,
        error: error as Error,
      });
      throw new Error(`Event validation failed: ${(error as Error).message}`);
    }
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      const result = await this.dynamoDB.getItem({
        TableName: this.processingTableName,
        Key: {
          eventId: { S: eventId },
        },
        ConsistentRead: true,
      });
      return !!result.Item;
    } catch (error) {
      console.error('Error checking event processing status:', error);
      return false;
    }
  }

  private async markEventAsProcessed(event: T): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
    
    await this.dynamoDB.putItem({
      TableName: this.processingTableName,
      Item: {
        eventId: { S: event.id },
        timestamp: { S: event.timestamp },
        type: { S: event.type },
        correlationId: { S: event.correlationId },
        source: { S: event.source },
        processingTime: { N: Date.now().toString() },
        ttl: { N: ttl.toString() },
        metadata: { S: JSON.stringify(event.metadata || {}) },
      },
      ConditionExpression: 'attribute_not_exists(eventId)',
    });
  }

  protected async handleProcessingError(event: any, error: Error): Promise<void> {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      event,
    };

    console.error('Event processing error:', errorDetails);

    await this.sendAlert({
      subject: `[${this.environment}] Event processing failure`,
      message: `Failed to process event: ${error.message}`,
      severity: 'HIGH',
      event,
      error,
    });
  }

  private async recordMetrics(data: {
    eventType: string;
    duration?: number;
    success: boolean;
  }): Promise<void> {
    const metrics = [
      {
        MetricName: 'EventProcessed',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Environment', Value: this.environment },
          { Name: 'EventType', Value: data.eventType },
          { Name: 'Status', Value: data.success ? 'Success' : 'Failed' },
        ],
      },
    ];

    if (data.duration) {
      metrics.push({
        MetricName: 'EventProcessingDuration',
        Value: data.duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Environment', Value: this.environment },
          { Name: 'EventType', Value: data.eventType },
        ],
      });
    }

    try {
      await this.cloudWatch.putMetricData({
        Namespace: 'Aletheia/Events',
        MetricData: metrics,
      });
    } catch (error) {
      console.error('Failed to record metrics:', error);
    }
  }

  private async sendAlert(alert: {
    subject: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    event: any;
    error?: Error;
  }): Promise<void> {
    if (!this.alertTopicArn) {
      console.warn('Alert topic ARN not configured, skipping alert');
      return;
    }

    try {
      await this.sns.publish({
        TopicArn: this.alertTopicArn,
        Subject: alert.subject,
        Message: JSON.stringify({
          message: alert.message,
          severity: alert.severity,
          timestamp: new Date().toISOString(),
          environment: this.environment,
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          event: alert.event,
          error: alert.error ? {
            message: alert.error.message,
            stack: alert.error.stack,
            name: alert.error.name,
          } : undefined,
        }, null, 2),
        MessageAttributes: {
          Severity: {
            DataType: 'String',
            StringValue: alert.severity,
          },
        },
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }
} 