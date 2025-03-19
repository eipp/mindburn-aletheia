import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthService } from '../services/auth.service';
import { RegisterRequestSchema, LoginRequestSchema } from '../types/api';
import { createLogger } from '@mindburn/shared';
import { z } from 'zod';

const logger = createLogger('AuthHandler');
const authService = new AuthService();

export async function register(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const data = RegisterRequestSchema.parse(JSON.parse(event.body));
    const result = await authService.register(data);

    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Registration failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request data',
          details: error.errors,
        }),
      };
    }

    if (error instanceof Error && error.message === 'Email already registered') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const data = LoginRequestSchema.parse(JSON.parse(event.body));
    const result = await authService.login(data);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Login failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request data',
          details: error.errors,
        }),
      };
    }

    if (error instanceof Error && error.message === 'Invalid credentials') {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function listApiKeys(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const result = await authService.listApiKeys(developerId);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Failed to list API keys', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function generateApiKey(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const apiKey = await authService.generateApiKey();

    return {
      statusCode: 201,
      body: JSON.stringify({ apiKey }),
    };
  } catch (error) {
    logger.error('Failed to generate API key', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

export async function revokeApiKey(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const apiKeyId = event.pathParameters?.apiKeyId;
    if (!apiKeyId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing API key ID' }),
      };
    }

    await authService.revokeApiKey(developerId, apiKeyId);

    return {
      statusCode: 204,
      body: '',
    };
  } catch (error) {
    logger.error('Failed to revoke API key', { error });

    if (error instanceof Error && error.message === 'API key not found') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
