import { EventBridge } from '@aws-sdk/client-eventbridge';
import { SNS } from '@aws-sdk/client-sns';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { AletheiaEvent } from '../../../infrastructure/src/events/schemas';
import { v4 as uuidv4 } from 'uuid';

export class EventProducer {
  private readonly eventBridge: EventBridge;
  private readonly sns: SNS;
  private readonly cloudWatch: CloudWatch;
  private readonly eventBusName: string;
  private readonly environment: string;
  private readonly alertTopicArn?: string;

  constructor(config: {
    eventBusName?: string;
    environment?: string;
    alertTopicArn?: string;
  } = {}) {
    this.eventBridge = new EventBridge({
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
    this.sns = new SNS();
    this.cloudWatch = new CloudWatch();
    this.eventBusName = config.eventBusName || process.env.EVENT_BUS_NAME || 'aletheia-events';
    this.environment = config.environment || process.env.ENVIRONMENT || 'dev';
    this.alertTopicArn = config.alertTopicArn || process.env.ALERT_TOPIC_ARN;
  }

  async publishEvent<T extends AletheiaEvent>(
    event: Omit<T, 'id' | 'timestamp' | 'correlationId'> & { correlationId?: string }
  ): Promise<string> {
    const startTime = Date.now();
    const enrichedEvent: T = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId || uuidv4(),
      metadata: {
        ...event.metadata,
        environment: this.environment,
        publisher: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
      },
    } as T;

    try {
      const result = await this.eventBridge.putEvents({
        Entries: [{
          EventBusName: this.eventBusName,
          Source: enrichedEvent.source,
          DetailType: enrichedEvent.type,
          Detail: JSON.stringify(enrichedEvent),
          Time: new Date(enrichedEvent.timestamp),
        }],
      });

      await this.recordMetrics({
        eventType: enrichedEvent.type,
        duration: Date.now() - startTime,
        success: true,
      });

      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        const failedEntries = result.Entries?.filter(entry => entry.ErrorCode);
        await this.handlePublishError(enrichedEvent, new Error('Partial publish failure'), failedEntries);
        throw new Error(`Failed to publish event: ${failedEntries?.[0]?.ErrorMessage}`);
      }

      return enrichedEvent.id;
    } catch (error) {
      await this.handlePublishError(enrichedEvent, error as Error);
      throw error;
    }
  }

  async retryFailedEvent<T extends AletheiaEvent>(event: T): Promise<string> {
    const retryCount = ((event.metadata?.retryCount as number) || 0) + 1;
    const maxRetries = 3;

    if (retryCount > maxRetries) {
      await this.sendAlert({
        subject: `[${this.environment}] Event retry limit exceeded`,
        message: `Event ${event.id} of type ${event.type} has exceeded retry limit of ${maxRetries}`,
        severity: 'HIGH',
        event,
      });
      throw new Error(`Retry limit exceeded for event ${event.id}`);
    }

    const retryEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        retryCount,
        originalEventId: event.id,
        retryTimestamp: new Date().toISOString(),
      },
    };

    return this.publishEvent(retryEvent);
  }

  private async handlePublishError(event: AletheiaEvent, error: Error, failedEntries?: any[]): Promise<void> {
    console.error('Event publish error:', {
      eventId: event.id,
      type: event.type,
      error: error.message,
      failedEntries,
    });

    await this.recordMetrics({
      eventType: event.type,
      success: false,
    });

    await this.sendAlert({
      subject: `[${this.environment}] Event publish failure`,
      message: `Failed to publish event ${event.id} of type ${event.type}: ${error.message}`,
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
        MetricName: 'EventPublished',
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
        MetricName: 'EventPublishDuration',
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
    event: AletheiaEvent;
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
          event: alert.event,
          error: alert.error ? {
            message: alert.error.message,
            stack: alert.error.stack,
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