import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { WebhookService } from '../services/webhook.service';
import { WebhookRequestSchema } from '../types/api';
import { createLogger } from '@mindburn/shared';
import { z } from 'zod';

const logger = createLogger('WebhookHandler');
const webhookService = new WebhookService();

export async function createWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const data = WebhookRequestSchema.parse(JSON.parse(event.body));
    const result = await webhookService.createWebhook(developerId, data);

    return {
      statusCode: 201,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Webhook creation failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid request data',
          details: error.errors
        })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function getWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const webhookId = event.pathParameters?.webhookId;
    if (!webhookId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing webhook ID' })
      };
    }

    const result = await webhookService.getWebhook(developerId, webhookId);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Failed to get webhook', { error });

    if (error instanceof Error) {
      if (error.message === 'Webhook not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to webhook') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function listWebhooks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const result = await webhookService.listWebhooks(developerId);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Failed to list webhooks', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function updateWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const webhookId = event.pathParameters?.webhookId;
    if (!webhookId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing webhook ID' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const data = WebhookRequestSchema.partial().parse(JSON.parse(event.body));
    await webhookService.updateWebhook(developerId, webhookId, data);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook updated successfully' })
    };
  } catch (error) {
    logger.error('Failed to update webhook', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid request data',
          details: error.errors
        })
      };
    }

    if (error instanceof Error) {
      if (error.message === 'Webhook not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to webhook') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function deleteWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const webhookId = event.pathParameters?.webhookId;
    if (!webhookId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing webhook ID' })
      };
    }

    await webhookService.deleteWebhook(developerId, webhookId);

    return {
      statusCode: 204,
      body: ''
    };
  } catch (error) {
    logger.error('Failed to delete webhook', { error });

    if (error instanceof Error) {
      if (error.message === 'Webhook not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to webhook') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function listDeliveries(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const webhookId = event.pathParameters?.webhookId;
    if (!webhookId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing webhook ID' })
      };
    }

    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit)
      : undefined;

    const result = await webhookService.listDeliveries(developerId, webhookId, limit);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Failed to list webhook deliveries', { error });

    if (error instanceof Error) {
      if (error.message === 'Webhook not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to webhook') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
} 