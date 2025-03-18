import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AnalyticsService } from '../services/analytics.service';
import { createLogger } from '@mindburn/shared';
import { z } from 'zod';

const logger = createLogger('AnalyticsHandler');
const analyticsService = new AnalyticsService();

const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().optional(),
});

export async function getTaskMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const queryParams = event.queryStringParameters || {};
    const params = DateRangeSchema.parse({
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      type: queryParams.type,
    });

    const result = await analyticsService.getTaskMetrics(developerId, params);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Failed to get task metrics', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request parameters',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function getBillingMetrics(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const queryParams = event.queryStringParameters || {};
    const params = DateRangeSchema.parse({
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      type: queryParams.type,
    });

    const result = await analyticsService.getBillingMetrics(developerId, params);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Failed to get billing metrics', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request parameters',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function getUsageQuota(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const result = await analyticsService.getUsageQuota(developerId);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Failed to get usage quota', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function getDailyTaskBreakdown(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const queryParams = event.queryStringParameters || {};
    const params = DateRangeSchema.parse({
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      type: queryParams.type,
    });

    const result = await analyticsService.getDailyTaskBreakdown(developerId, params);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Failed to get daily task breakdown', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request parameters',
          details: error.errors,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Internal handler for tracking usage
export async function trackUsage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // This endpoint should only be accessible internally
    const sourceIp = event.requestContext.identity?.sourceIp;
    if (!process.env.ALLOWED_INTERNAL_IPS?.split(',').includes(sourceIp)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const { developerId, ...data } = JSON.parse(event.body);
    if (!developerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing developer ID' }),
      };
    }

    await analyticsService.trackUsage(developerId, data);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Usage tracked successfully' }),
    };
  } catch (error) {
    logger.error('Failed to track usage', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
