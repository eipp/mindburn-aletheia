import { Request, Response, NextFunction } from 'express';
import * as cloudwatch from 'aws-sdk/clients/cloudwatch';
import * as crypto from 'crypto';

interface MetricsConfig {
  namespace: string;
  environment: string;
  service: string;
  enableDetailedMetrics?: boolean;
}

export class MetricsMiddleware {
  private cloudwatch: cloudwatch;
  private config: MetricsConfig;
  private requestStartTime: Map<string, number>;

  constructor(config: MetricsConfig) {
    this.config = config;
    this.cloudwatch = new cloudwatch();
    this.requestStartTime = new Map();
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] || crypto.randomUUID();
      const startTime = Date.now();
      this.requestStartTime.set(requestId, startTime);

      // Add response listener to capture response time and status
      res.on('finish', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const statusCode = res.statusCode;
        const path = req.path;
        const method = req.method;

        // Log basic metrics
        this.logMetrics([
          {
            MetricName: 'ApiLatency',
            Value: duration,
            Unit: 'Milliseconds',
            Dimensions: [
              { Name: 'Service', Value: this.config.service },
              { Name: 'Environment', Value: this.config.environment },
              { Name: 'Path', Value: path },
              { Name: 'Method', Value: method },
            ],
          },
          {
            MetricName: 'ApiErrorRate',
            Value: statusCode >= 400 ? 1 : 0,
            Unit: 'Count',
            Dimensions: [
              { Name: 'Service', Value: this.config.service },
              { Name: 'Environment', Value: this.config.environment },
              { Name: 'Path', Value: path },
              { Name: 'Method', Value: method },
            ],
          },
        ]);

        // Track payment metrics if this is a payment endpoint
        if (this.config.service === 'paymentSystem' || path.includes('/payment')) {
          this.logPaymentMetrics(req, res, statusCode);
        }

        // Log detailed metrics if enabled
        if (this.config.enableDetailedMetrics) {
          this.logDetailedMetrics(req, res, duration, statusCode);
        }

        // Clean up request start time
        this.requestStartTime.delete(requestId);
      });

      next();
    };
  }

  private async logPaymentMetrics(req: Request, res: Response, statusCode: number) {
    // Extract payment information from request/response
    const isPaymentSuccess = statusCode >= 200 && statusCode < 300;
    const paymentType = req.body?.paymentType || 'unknown';
    const paymentAmount = req.body?.amount || 0;
    const transactionId = req.body?.transactionId || res.locals.transactionId || 'unknown';
    const batchId = req.body?.batchId || res.locals.batchId;
    
    // Transaction metrics
    const metrics = [
      {
        MetricName: 'PaymentAttempts',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'PaymentType', Value: paymentType },
        ],
      },
      {
        MetricName: 'PaymentSuccess',
        Value: isPaymentSuccess ? 1 : 0,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'PaymentType', Value: paymentType },
        ],
      }
    ];

    // Add volume metrics if we have amount
    if (paymentAmount > 0) {
      metrics.push({
        MetricName: 'PaymentVolume',
        Value: paymentAmount,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'PaymentType', Value: paymentType },
        ],
      });
    }

    // Add batch metrics if this is a batch payment
    if (batchId) {
      metrics.push({
        MetricName: 'BatchPaymentSuccess',
        Value: isPaymentSuccess ? 1 : 0,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'BatchId', Value: batchId },
        ],
      });
    }

    await this.logMetrics(metrics);
  }

  private async logDetailedMetrics(
    req: Request,
    res: Response,
    duration: number,
    statusCode: number
  ) {
    const path = req.path;
    const method = req.method;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // Log request size
    const requestSize = this.getRequestSize(req);
    this.logMetrics([
      {
        MetricName: 'RequestSize',
        Value: requestSize,
        Unit: 'Bytes',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'Path', Value: path },
          { Name: 'Method', Value: method },
        ],
      },
    ]);

    // Log response size
    const responseSize = this.getResponseSize(res);
    this.logMetrics([
      {
        MetricName: 'ResponseSize',
        Value: responseSize,
        Unit: 'Bytes',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'Path', Value: path },
          { Name: 'Method', Value: method },
        ],
      },
    ]);

    // Log user agent metrics
    this.logMetrics([
      {
        MetricName: 'UserAgentRequests',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'UserAgent', Value: userAgent },
        ],
      },
    ]);

    // Log IP metrics
    this.logMetrics([
      {
        MetricName: 'IPRequests',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'IP', Value: ip },
        ],
      },
    ]);

    // Log status code distribution
    this.logMetrics([
      {
        MetricName: 'StatusCodeDistribution',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Service', Value: this.config.service },
          { Name: 'Environment', Value: this.config.environment },
          { Name: 'StatusCode', Value: statusCode.toString() },
        ],
      },
    ]);
  }

  private async logMetrics(metrics: cloudwatch.MetricDatum[]) {
    try {
      await this.cloudwatch.putMetricData({
        Namespace: this.config.namespace,
        MetricData: metrics.map(metric => ({
          ...metric,
          Timestamp: new Date(),
        })),
      }).promise();
    } catch (error) {
      console.error('Failed to log metrics:', error);
    }
  }

  private getRequestSize(req: Request): number {
    let size = 0;
    
    // Add headers size
    Object.entries(req.headers).forEach(([key, value]) => {
      size += key.length + (value ? value.toString().length : 0);
    });

    // Add body size if available
    if (req.body) {
      size += JSON.stringify(req.body).length;
    }

    return size;
  }

  private getResponseSize(res: Response): number {
    let size = 0;
    
    // Add headers size
    Object.entries(res.getHeaders()).forEach(([key, value]) => {
      size += key.length + (value ? value.toString().length : 0);
    });

    // Add body size if available
    if (res.locals.body) {
      size += JSON.stringify(res.locals.body).length;
    }

    return size;
  }
}

/**
 * Create a metrics middleware factory
 */
export function createMetricsMiddleware(config: MetricsConfig) {
  const middleware = new MetricsMiddleware(config);
  return middleware.middleware();
} 