import { Handler } from 'aws-lambda';
import { CloudTrail } from 'aws-sdk';
import log from '../utils/logger';

const cloudTrail = new CloudTrail();

interface SecurityContext {
  userId?: string;
  action: string;
  resource: string;
  sourceIp: string;
}

export const securityMiddleware = (handler: Handler): Handler => {
  return async (event, context) => {
    const startTime = Date.now();
    const requestId = context.awsRequestId;

    // Extract security context
    const securityContext: SecurityContext = {
      userId: event.requestContext?.authorizer?.claims?.sub,
      action: `${event.httpMethod} ${event.path}`,
      resource: event.resource,
      sourceIp: event.requestContext?.identity?.sourceIp || 'unknown',
    };

    try {
      // Validate request headers
      validateSecurityHeaders(event.headers || {});

      // Log security event start
      await logSecurityEvent({
        ...securityContext,
        eventName: 'RequestStarted',
        requestId,
      });

      // Execute handler
      const response = await handler(event, context);

      // Log security event completion
      await logSecurityEvent({
        ...securityContext,
        eventName: 'RequestCompleted',
        requestId,
        statusCode: response.statusCode,
        duration: Date.now() - startTime,
      });

      // Add security headers to response
      return {
        ...response,
        headers: {
          ...response.headers,
          ...getSecurityHeaders(),
        },
      };
    } catch (error) {
      // Log security event failure
      await logSecurityEvent({
        ...securityContext,
        eventName: 'RequestFailed',
        requestId,
        error: error as Error,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  };
};

function validateSecurityHeaders(headers: Record<string, string>) {
  // Required headers
  const requiredHeaders = ['x-api-key'];
  for (const header of requiredHeaders) {
    if (!headers[header]) {
      throw new Error(`Missing required header: ${header}`);
    }
  }

  // Content type validation
  if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
    throw new Error('Invalid content type. Only application/json is supported.');
  }
}

function getSecurityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Cache-Control': 'no-store, max-age=0',
  };
}

async function logSecurityEvent(event: Record<string, any>) {
  // Log to CloudWatch
  log.info('Security event', {
    type: 'SECURITY_AUDIT',
    ...event,
  });

  // Log to CloudTrail
  try {
    await cloudTrail.putEventsAsync([
      {
        EventName: event.eventName,
        EventSource: 'aletheia.worker-interface',
        Resources: [
          {
            ResourceName: event.resource,
            ResourceType: 'API',
          },
        ],
        Username: event.userId || 'anonymous',
        CloudTrailEvent: JSON.stringify(event),
      },
    ]);
  } catch (error) {
    log.error('Failed to log to CloudTrail', error as Error);
  }
} 