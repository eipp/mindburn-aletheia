import * as CloudWatch from 'aws-sdk/clients/cloudwatch';
import * as SNS from 'aws-sdk/clients/sns';
import * as crypto from 'crypto';

/**
 * Security monitoring configuration
 */
export interface SecurityMonitoringConfig {
  /**
   * AWS region
   */
  region: string;
  
  /**
   * Environment (dev, staging, prod)
   */
  environment: string;
  
  /**
   * Service name
   */
  service: string;
  
  /**
   * SNS topic ARN for alerts
   */
  alertTopicArn?: string;
  
  /**
   * Enable detailed logging
   */
  detailedLogging?: boolean;
  
  /**
   * Enable metrics
   */
  enableMetrics?: boolean;
  
  /**
   * Metrics namespace
   */
  metricsNamespace?: string;
  
  /**
   * Alert thresholds
   */
  thresholds?: {
    /**
     * Authentication failure threshold (count per minute)
     */
    authFailures?: number;
    
    /**
     * Rate limit exceeded threshold (count per minute)
     */
    rateLimitExceeded?: number;
    
    /**
     * Suspicious activity threshold (count per minute)
     */
    suspiciousActivity?: number;
    
    /**
     * Server error threshold (count per minute)
     */
    serverErrors?: number;
  };
}

/**
 * Default security monitoring configuration
 */
const defaultConfig: SecurityMonitoringConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  environment: process.env.NODE_ENV || 'development',
  service: 'mindburn-aletheia',
  detailedLogging: true,
  enableMetrics: true,
  metricsNamespace: 'MindBurnAletheia/Security',
  thresholds: {
    authFailures: 5,
    rateLimitExceeded: 10,
    suspiciousActivity: 3,
    serverErrors: 5,
  },
};

/**
 * Security event types
 */
export enum SecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ENCRYPTION_ERROR = 'encryption_error',
  API_ACCESS_DENIED = 'api_access_denied',
  SERVER_ERROR = 'server_error',
  PERMISSION_CHANGE = 'permission_change',
  ADMIN_ACTION = 'admin_action',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
}

/**
 * Security event severity
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  /**
   * Event type
   */
  type: SecurityEventType;
  
  /**
   * Event severity
   */
  severity: SecurityEventSeverity;
  
  /**
   * User identifier (if applicable)
   */
  userId?: string;
  
  /**
   * IP address
   */
  ipAddress?: string;
  
  /**
   * User agent
   */
  userAgent?: string;
  
  /**
   * Request path
   */
  path?: string;
  
  /**
   * Request method
   */
  method?: string;
  
  /**
   * Request ID
   */
  requestId?: string;
  
  /**
   * Event timestamp
   */
  timestamp: number;
  
  /**
   * Detailed message
   */
  message: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Security monitoring service
 */
export class SecurityMonitoringService {
  private cloudwatch: CloudWatch;
  private sns: SNS;
  private config: SecurityMonitoringConfig;
  private eventCache: Map<string, { count: number, lastAlertTime: number }>;
  
  constructor(config: Partial<SecurityMonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.cloudwatch = new CloudWatch({ region: this.config.region });
    this.sns = new SNS({ region: this.config.region });
    this.eventCache = new Map();
    
    // Initialize cleanup interval for the event cache
    setInterval(() => this.cleanupEventCache(), 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Log a security event
   */
  public async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };
    
    // Log the event
    if (this.config.detailedLogging) {
      console.log(JSON.stringify({
        level: mapSeverityToLogLevel(securityEvent.severity),
        event_type: securityEvent.type,
        message: securityEvent.message,
        user_id: securityEvent.userId,
        ip_address: securityEvent.ipAddress,
        user_agent: securityEvent.userAgent,
        path: securityEvent.path,
        method: securityEvent.method,
        request_id: securityEvent.requestId,
        timestamp: new Date(securityEvent.timestamp).toISOString(),
        environment: this.config.environment,
        service: this.config.service,
        ...securityEvent.metadata,
      }));
    }
    
    // Push metrics if enabled
    if (this.config.enableMetrics) {
      await this.pushMetrics(securityEvent);
    }
    
    // Check if the event should trigger an alert
    await this.checkAndSendAlert(securityEvent);
  }
  
  /**
   * Push metrics to CloudWatch
   */
  private async pushMetrics(event: SecurityEvent): Promise<void> {
    try {
      const dimensions = [
        {
          Name: 'Environment',
          Value: this.config.environment,
        },
        {
          Name: 'Service',
          Value: this.config.service,
        },
        {
          Name: 'EventType',
          Value: event.type,
        },
        {
          Name: 'Severity',
          Value: event.severity,
        },
      ];
      
      // Add user dimension if available
      if (event.userId) {
        dimensions.push({
          Name: 'UserId',
          Value: event.userId,
        });
      }
      
      // Add endpoint dimension if available
      if (event.path) {
        dimensions.push({
          Name: 'Endpoint',
          Value: event.path,
        });
      }
      
      await this.cloudwatch.putMetricData({
        Namespace: this.config.metricsNamespace || 'MindBurnAletheia/Security',
        MetricData: [
          {
            MetricName: 'SecurityEvents',
            Dimensions: dimensions,
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(event.timestamp),
          },
        ],
      }).promise();
    } catch (error) {
      console.error('Failed to push security metrics:', error);
    }
  }
  
  /**
   * Check if an event should trigger an alert and send it
   */
  private async checkAndSendAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.alertTopicArn) {
      return;
    }
    
    // Always alert for high and critical severity events
    if (event.severity === SecurityEventSeverity.HIGH || event.severity === SecurityEventSeverity.CRITICAL) {
      await this.sendAlert(event);
      return;
    }
    
    // Check thresholds for other event types
    const shouldAlert = this.checkEventThresholds(event);
    
    if (shouldAlert) {
      await this.sendAlert(event);
    }
  }
  
  /**
   * Check if an event exceeds configured thresholds
   */
  private checkEventThresholds(event: SecurityEvent): boolean {
    const thresholds = this.config.thresholds;
    if (!thresholds) {
      return false;
    }
    
    // Create a cache key from event type and related identifiers
    const cacheKey = this.createEventCacheKey(event);
    
    // Get or initialize cache entry
    const now = Date.now();
    const cacheEntry = this.eventCache.get(cacheKey) || { count: 0, lastAlertTime: 0 };
    
    // Update count
    cacheEntry.count += 1;
    
    // Check if we should alert based on thresholds
    let threshold = 0;
    let alertCooldownPeriod = 15 * 60 * 1000; // 15 minutes default
    
    switch (event.type) {
      case SecurityEventType.AUTH_FAILURE:
        threshold = thresholds.authFailures || 5;
        break;
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        threshold = thresholds.rateLimitExceeded || 10;
        break;
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        threshold = thresholds.suspiciousActivity || 3;
        alertCooldownPeriod = 5 * 60 * 1000; // 5 minutes for suspicious activity
        break;
      case SecurityEventType.SERVER_ERROR:
        threshold = thresholds.serverErrors || 5;
        break;
      default:
        threshold = 10; // Default threshold
    }
    
    // Check if we reached the threshold and are not in cooldown period
    const shouldAlert = cacheEntry.count >= threshold && 
                        (now - cacheEntry.lastAlertTime > alertCooldownPeriod);
    
    if (shouldAlert) {
      // Update last alert time
      cacheEntry.lastAlertTime = now;
      cacheEntry.count = 0; // Reset count after alert
    }
    
    // Update cache
    this.eventCache.set(cacheKey, cacheEntry);
    
    return shouldAlert;
  }
  
  /**
   * Create a cache key for event aggregation
   */
  private createEventCacheKey(event: SecurityEvent): string {
    const keyParts = [
      event.type,
      event.ipAddress || 'unknown',
      event.path || 'unknown',
    ];
    
    // Add minute timestamp to group events within the same minute
    const minuteTimestamp = Math.floor(event.timestamp / (60 * 1000));
    keyParts.push(minuteTimestamp.toString());
    
    return crypto.createHash('md5').update(keyParts.join(':').toLowerCase()).digest('hex');
  }
  
  /**
   * Clean up the event cache
   */
  private cleanupEventCache(): void {
    const now = Date.now();
    const expirationTime = 30 * 60 * 1000; // 30 minutes
    
    for (const [key, entry] of this.eventCache.entries()) {
      if (now - entry.lastAlertTime > expirationTime && entry.count === 0) {
        this.eventCache.delete(key);
      }
    }
  }
  
  /**
   * Send an alert via SNS
   */
  private async sendAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.alertTopicArn) {
      return;
    }
    
    try {
      const subject = `[${this.config.environment.toUpperCase()}] ${event.severity.toUpperCase()} Security Alert: ${event.type}`;
      
      const message = {
        environment: this.config.environment,
        service: this.config.service,
        alert_type: event.type,
        severity: event.severity,
        message: event.message,
        timestamp: new Date(event.timestamp).toISOString(),
        details: {
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          path: event.path,
          method: event.method,
          request_id: event.requestId,
        },
        metadata: event.metadata,
      };
      
      await this.sns.publish({
        TopicArn: this.config.alertTopicArn,
        Subject: subject.slice(0, 100), // SNS subject has a 100 character limit
        Message: JSON.stringify(message, null, 2),
        MessageAttributes: {
          severity: {
            DataType: 'String',
            StringValue: event.severity,
          },
          event_type: {
            DataType: 'String',
            StringValue: event.type,
          },
          environment: {
            DataType: 'String',
            StringValue: this.config.environment,
          },
        },
      }).promise();
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
  
  /**
   * Log authentication success
   */
  public async logAuthSuccess(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.AUTH_SUCCESS,
      severity: SecurityEventSeverity.INFO,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      message: `Successful authentication for user ${params.userId}`,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log authentication failure
   */
  public async logAuthFailure(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.AUTH_FAILURE,
      severity: SecurityEventSeverity.MEDIUM,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
      message: `Authentication failure${params.userId ? ` for user ${params.userId}` : ''}${params.reason ? `: ${params.reason}` : ''}`,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log rate limit exceeded
   */
  public async logRateLimitExceeded(params: {
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      path: params.path,
      method: params.method,
      requestId: params.requestId,
      message: `Rate limit exceeded for ${params.path || 'endpoint'} from ${params.ipAddress || 'unknown IP'}`,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log suspicious activity
   */
  public async logSuspiciousActivity(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    requestId?: string;
    description: string;
    severity?: SecurityEventSeverity;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: params.severity || SecurityEventSeverity.HIGH,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      path: params.path,
      method: params.method,
      requestId: params.requestId,
      message: params.description,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log API access denied
   */
  public async logApiAccessDenied(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    requestId?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.API_ACCESS_DENIED,
      severity: SecurityEventSeverity.MEDIUM,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      path: params.path,
      method: params.method,
      requestId: params.requestId,
      message: `API access denied${params.userId ? ` for user ${params.userId}` : ''}${params.reason ? `: ${params.reason}` : ''}`,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log sensitive data access
   */
  public async logSensitiveDataAccess(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    requestId?: string;
    dataType: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.SENSITIVE_DATA_ACCESS,
      severity: SecurityEventSeverity.LOW,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      path: params.path,
      method: params.method,
      requestId: params.requestId,
      message: `Sensitive data access: ${params.dataType} by user ${params.userId}`,
      metadata: params.metadata,
    });
  }
}

/**
 * Map severity to log level
 */
function mapSeverityToLogLevel(severity: SecurityEventSeverity): string {
  switch (severity) {
    case SecurityEventSeverity.INFO:
      return 'info';
    case SecurityEventSeverity.LOW:
      return 'warn';
    case SecurityEventSeverity.MEDIUM:
      return 'warn';
    case SecurityEventSeverity.HIGH:
      return 'error';
    case SecurityEventSeverity.CRITICAL:
      return 'fatal';
    default:
      return 'info';
  }
} 