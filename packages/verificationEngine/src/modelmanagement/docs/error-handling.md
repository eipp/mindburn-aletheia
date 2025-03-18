# Error Handling System

The error handling system provides a robust framework for managing errors in the model management system. It includes features such as automatic retries, error notifications, error reporting, performance monitoring, and fallback strategies.

## Features

### 1. Error Severity Levels
- `low`: Minor issues that don't affect core functionality
- `medium`: Issues that may affect performance but not critical operations
- `high`: Significant issues that affect core functionality
- `critical`: Severe issues that require immediate attention

### 2. Retry Mechanism
- Configurable retry attempts with exponential backoff
- Per-handler retry configuration
- Example:
```typescript
retryConfig: {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
}
```

### 3. Notification System
- Multiple notification channels (Slack, Email, PagerDuty)
- Throttling to prevent notification flooding
- Configurable per handler
- Example:
```typescript
notificationConfig: {
  enabled: true,
  channels: ['slack', 'email'],
  throttlingPeriod: 3600, // seconds
}
```

### 4. Error Reporting
- Integration with multiple services (Sentry, Rollbar, CloudWatch)
- Environment-aware configuration
- Sampling rate control
- Example:
```typescript
errorReporting: {
  enabled: true,
  service: 'sentry',
  environment: 'production',
  sampleRate: 1.0,
}
```

### 5. Error Monitoring
- Error rate tracking
- Configurable thresholds
- Automated alerting
- Example:
```typescript
monitoring: {
  enabled: true,
  errorRateThreshold: 0.01,
  alertingEnabled: true,
}
```

### 6. Fallback Strategy
- Configurable default responses
- Logging of fallback usage
- Example:
```typescript
fallbackStrategy: {
  enabled: true,
  defaultResponse: null,
  logFallback: true,
}
```

## Usage

### Basic Setup
```typescript
import { createModelRegistry } from '../factories/create-model-registry';

const registry = await createModelRegistry({
  errorConfigOverrides: {
    enabled: true,
    // ... custom configuration
  }
});
```

### Custom Error Handler
```typescript
const errorConfigOverrides = {
  handlers: {
    customOperation: {
      name: 'custom_operation',
      enabled: true,
      severity: 'high',
      retryConfig: {
        maxAttempts: 5,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
      },
      notificationConfig: {
        enabled: true,
        channels: ['slack', 'email'],
        throttlingPeriod: 1800,
      },
    },
  },
};
```

### Error Metrics
```typescript
// Get error metrics for a specific operation
const metrics = registry.getErrorMetrics('modelRegistration');
console.log('Error count:', metrics.errorCount);
console.log('Error rate:', metrics.errorRate);
```

## Environment Variables

The following environment variables can be used to configure the error handling system:

- `ERROR_HANDLING_ENABLED`: Enable/disable error handling (true/false)
- `LOG_ERRORS`: Enable/disable error logging (true/false)
- `LOG_STACK_TRACES`: Enable/disable stack trace logging (true/false)
- `ERROR_REPORTING_ENABLED`: Enable/disable error reporting (true/false)
- `ERROR_REPORTING_SERVICE`: Error reporting service (sentry/rollbar/cloudwatch)
- `ERROR_SAMPLING_RATE`: Error sampling rate (0.0-1.0)
- `ERROR_MONITORING_ENABLED`: Enable/disable error monitoring (true/false)
- `ERROR_RATE_THRESHOLD`: Error rate threshold for alerts
- `ERROR_ALERTING_ENABLED`: Enable/disable error alerting (true/false)
- `FALLBACK_STRATEGY_ENABLED`: Enable/disable fallback strategy (true/false)
- `LOG_FALLBACK`: Enable/disable fallback logging (true/false)

## AWS Resources

The error handling system uses the following AWS services:

- **CloudWatch**: For error metrics and monitoring
- **SNS**: For notifications (Slack, Email, PagerDuty)
- **IAM**: Required permissions for CloudWatch and SNS

Required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": [
        "arn:aws:sns:*:*:slack-topic",
        "arn:aws:sns:*:*:email-topic",
        "arn:aws:sns:*:*:pagerduty-topic",
        "arn:aws:sns:*:*:alerts-topic"
      ]
    }
  ]
}
```

## Best Practices

1. **Error Severity**
   - Use appropriate severity levels based on business impact
   - Configure notification channels based on severity
   - Set up different retry strategies for different severity levels

2. **Retry Configuration**
   - Use exponential backoff to prevent overwhelming services
   - Set reasonable maximum attempts based on operation criticality
   - Consider operation idempotency when configuring retries

3. **Notifications**
   - Implement throttling to prevent alert fatigue
   - Use different channels for different severity levels
   - Include relevant context in notifications

4. **Monitoring**
   - Set appropriate error rate thresholds
   - Monitor error trends over time
   - Set up alerts for unusual error patterns

5. **Fallback Strategies**
   - Define safe default responses
   - Log fallback usage for analysis
   - Review fallback patterns regularly

## Example Implementation

See the [error-handling-example.ts](../examples/error-handling-example.ts) file for a complete example of how to use the error handling system.

## Testing

The error handling system includes comprehensive tests:

- Unit tests for configuration validation
- Integration tests for error handlers
- Mock tests for AWS services
- Error scenario testing

Run tests using:
```bash
npm test
```

## Troubleshooting

Common issues and solutions:

1. **High Error Rates**
   - Check error metrics in CloudWatch
   - Review error patterns in logs
   - Adjust retry configurations if needed

2. **Missing Notifications**
   - Verify SNS topic configurations
   - Check IAM permissions
   - Review notification throttling settings

3. **Performance Impact**
   - Monitor retry latency
   - Adjust backoff configurations
   - Consider reducing retry attempts

4. **Error Reporting Issues**
   - Verify service credentials
   - Check sampling rate configuration
   - Review error reporting service status 