import { ErrorHandlingConfig, ErrorHandlerConfig, ErrorSeverity } from '../config/error-handling-config';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SentryClient } from '@sentry/node';
import { RollbarClient } from 'rollbar';

export interface ErrorContext {
  modelId?: string;
  version?: string;
  operation?: string;
  userId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastError: Date;
  severity: ErrorSeverity;
}

export class ErrorHandler {
  private config: ErrorHandlingConfig;
  private cloudWatch: CloudWatchClient;
  private sns: SNSClient;
  private sentry?: SentryClient;
  private rollbar?: RollbarClient;
  private errorMetrics: Map<string, ErrorMetrics>;
  private lastNotification: Map<string, Date>;

  constructor(config: ErrorHandlingConfig) {
    this.config = config;
    this.cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
    this.sns = new SNSClient({ region: process.env.AWS_REGION });
    this.errorMetrics = new Map();
    this.lastNotification = new Map();
    this.initializeErrorReporting();
  }

  private initializeErrorReporting(): void {
    const { service, environment } = this.config.globalConfig.errorReporting;
    
    if (service === 'sentry') {
      this.sentry = new SentryClient({
        dsn: process.env.SENTRY_DSN,
        environment,
        sampleRate: this.config.globalConfig.errorReporting.sampleRate,
      });
    } else if (service === 'rollbar') {
      this.rollbar = new RollbarClient({
        accessToken: process.env.ROLLBAR_TOKEN,
        environment,
        captureUncaught: true,
        captureUnhandledRejections: true,
      });
    }
  }

  private getHandlerConfig(handlerId: string): ErrorHandlerConfig {
    return this.config.handlers[handlerId] || this.config.defaultHandler;
  }

  private async handleRetry<T>(
    handlerConfig: ErrorHandlerConfig,
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    const { maxAttempts, backoffMultiplier, initialDelayMs } = handlerConfig.retryConfig;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxAttempts) break;

        const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private async sendNotification(
    handlerConfig: ErrorHandlerConfig,
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    if (!handlerConfig.notificationConfig.enabled) return;

    const handlerId = handlerConfig.name;
    const lastNotification = this.lastNotification.get(handlerId);
    const now = new Date();

    if (lastNotification && 
        (now.getTime() - lastNotification.getTime()) < handlerConfig.notificationConfig.throttlingPeriod * 1000) {
      return;
    }

    const message = {
      error: error.message,
      stack: this.config.globalConfig.logStackTraces ? error.stack : undefined,
      context,
      severity: handlerConfig.severity,
      timestamp: now.toISOString(),
    };

    for (const channel of handlerConfig.notificationConfig.channels) {
      try {
        if (channel === 'slack') {
          await this.sns.send(new PublishCommand({
            TopicArn: process.env.SLACK_SNS_TOPIC,
            Message: JSON.stringify(message),
          }));
        } else if (channel === 'email') {
          await this.sns.send(new PublishCommand({
            TopicArn: process.env.EMAIL_SNS_TOPIC,
            Message: JSON.stringify(message),
          }));
        } else if (channel === 'pagerduty') {
          await this.sns.send(new PublishCommand({
            TopicArn: process.env.PAGERDUTY_SNS_TOPIC,
            Message: JSON.stringify(message),
          }));
        }
      } catch (error) {
        console.error(`Failed to send notification to ${channel}:`, error);
      }
    }

    this.lastNotification.set(handlerId, now);
  }

  private async reportError(error: Error, context: ErrorContext): Promise<void> {
    if (!this.config.globalConfig.errorReporting.enabled) return;

    try {
      if (this.sentry) {
        this.sentry.captureException(error, { extra: context });
      } else if (this.rollbar) {
        this.rollbar.error(error, context);
      } else {
        await this.cloudWatch.send(new PutMetricDataCommand({
          Namespace: 'ModelManagement',
          MetricData: [{
            MetricName: 'Errors',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
              { Name: 'Environment', Value: this.config.globalConfig.errorReporting.environment },
              { Name: 'ModelId', Value: context.modelId || 'unknown' },
              { Name: 'Operation', Value: context.operation || 'unknown' },
            ],
          }],
        }));
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private updateErrorMetrics(handlerId: string, severity: ErrorSeverity): void {
    const now = new Date();
    const metrics = this.errorMetrics.get(handlerId) || {
      errorCount: 0,
      errorRate: 0,
      lastError: now,
      severity,
    };

    metrics.errorCount++;
    metrics.lastError = now;
    metrics.severity = severity;

    // Calculate error rate over the last hour
    const hourAgo = new Date(now.getTime() - 3600000);
    metrics.errorRate = metrics.errorCount / (now.getTime() - hourAgo.getTime()) * 1000;

    this.errorMetrics.set(handlerId, metrics);

    if (this.config.globalConfig.monitoring.enabled &&
        this.config.globalConfig.monitoring.alertingEnabled &&
        metrics.errorRate > this.config.globalConfig.monitoring.errorRateThreshold) {
      this.handleHighErrorRate(handlerId, metrics);
    }
  }

  private async handleHighErrorRate(handlerId: string, metrics: ErrorMetrics): Promise<void> {
    const message = {
      type: 'high_error_rate_alert',
      handlerId,
      errorRate: metrics.errorRate,
      threshold: this.config.globalConfig.monitoring.errorRateThreshold,
      errorCount: metrics.errorCount,
      lastError: metrics.lastError,
      severity: metrics.severity,
    };

    try {
      await this.sns.send(new PublishCommand({
        TopicArn: process.env.ALERTS_SNS_TOPIC,
        Message: JSON.stringify(message),
      }));
    } catch (error) {
      console.error('Failed to send high error rate alert:', error);
    }
  }

  public async handleError<T>(
    handlerId: string,
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    const handlerConfig = this.getHandlerConfig(handlerId);
    if (!handlerConfig.enabled) {
      return operation();
    }

    try {
      return await this.handleRetry(handlerConfig, operation, context);
    } catch (error) {
      const typedError = error as Error;

      if (this.config.globalConfig.logErrors) {
        console.error('Operation failed:', {
          handlerId,
          error: typedError.message,
          stack: this.config.globalConfig.logStackTraces ? typedError.stack : undefined,
          context,
        });
      }

      await Promise.all([
        this.reportError(typedError, context),
        this.sendNotification(handlerConfig, typedError, context),
      ]);

      this.updateErrorMetrics(handlerId, handlerConfig.severity);

      if (this.config.fallbackStrategy.enabled) {
        if (this.config.fallbackStrategy.logFallback) {
          console.log('Using fallback strategy for failed operation:', {
            handlerId,
            context,
            fallbackResponse: this.config.fallbackStrategy.defaultResponse,
          });
        }
        return this.config.fallbackStrategy.defaultResponse;
      }

      throw typedError;
    }
  }

  public getMetrics(handlerId: string): ErrorMetrics | undefined {
    return this.errorMetrics.get(handlerId);
  }

  public clearMetrics(handlerId: string): void {
    this.errorMetrics.delete(handlerId);
  }
} 