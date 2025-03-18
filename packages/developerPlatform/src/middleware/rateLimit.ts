import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from 'redis';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('RateLimitMiddleware');
const redis = createClient({
  url: process.env.REDIS_URL,
});

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const defaultLimits: { [key: string]: RateLimitConfig } = {
  'POST /tasks': { windowMs: 60 * 1000, max: 10 }, // 10 requests per minute
  'GET /tasks': { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  'GET /analytics': { windowMs: 60 * 1000, max: 50 }, // 50 requests per minute
  default: { windowMs: 60 * 1000, max: 100 }, // Default limit
};

export async function rateLimitMiddleware(
  event: APIGatewayProxyEvent,
  limits: { [key: string]: RateLimitConfig } = defaultLimits
): Promise<APIGatewayProxyResult | null> {
  try {
    await redis.connect();

    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const method = event.httpMethod;
    const path = event.path.split('/').slice(0, 3).join('/'); // Get base path
    const endpoint = `${method} ${path}`;
    const limit = limits[endpoint] || limits.default;

    const key = `ratelimit:${developerId}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    // Clean up old requests
    await redis.zRemRangeByScore(key, 0, windowStart);

    // Count requests in current window
    const requestCount = await redis.zCard(key);

    if (requestCount >= limit.max) {
      logger.warn('Rate limit exceeded', { developerId, endpoint, requestCount });
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil((windowStart + limit.windowMs - now) / 1000),
        }),
        headers: {
          'Retry-After': Math.ceil((windowStart + limit.windowMs - now) / 1000).toString(),
        },
      };
    }

    // Add current request
    await redis.zAdd(key, { score: now, value: now.toString() });
    // Set expiration for the key
    await redis.expire(key, Math.ceil(limit.windowMs / 1000));

    // Add rate limit headers
    const remaining = limit.max - requestCount - 1;
    const reset = Math.ceil((windowStart + limit.windowMs) / 1000);

    logger.debug('Rate limit check passed', {
      developerId,
      endpoint,
      remaining,
      reset,
    });

    // Attach rate limit info to the event for response headers
    event.headers = {
      ...event.headers,
      'X-RateLimit-Limit': limit.max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    };

    return null; // Continue processing
  } catch (error) {
    logger.error('Rate limit check failed', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await redis.disconnect();
  }
}

// Helper function to add rate limit headers to response
export function addRateLimitHeaders(
  response: APIGatewayProxyResult,
  event: APIGatewayProxyEvent
): APIGatewayProxyResult {
  const headers = {
    ...response.headers,
    'X-RateLimit-Limit': event.headers['X-RateLimit-Limit'],
    'X-RateLimit-Remaining': event.headers['X-RateLimit-Remaining'],
    'X-RateLimit-Reset': event.headers['X-RateLimit-Reset'],
  };

  return {
    ...response,
    headers,
  };
}

// Higher-order function to wrap Lambda handlers with rate limiting
export function withRateLimit(
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>,
  limits?: { [key: string]: RateLimitConfig }
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const rateLimitResult = await rateLimitMiddleware(event, limits);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const result = await handler(event);
    return addRateLimitHeaders(result, event);
  };
}
