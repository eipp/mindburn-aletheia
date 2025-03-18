import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { AuthService } from '../services/auth.service';
import { createLogger } from '@mindburn/shared';
import * as jwt from 'jsonwebtoken';

const logger = createLogger('AuthMiddleware');
const authService = new AuthService();
const JWT_SECRET = process.env.JWT_SECRET!;

export async function jwtAuthorizer(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  try {
    const token = event.authorizationToken.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { developerId: string };

    logger.info('JWT token validated', { developerId: decoded.developerId });

    return {
      principalId: decoded.developerId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      },
      context: {
        developerId: decoded.developerId
      }
    };
  } catch (error) {
    logger.error('JWT validation failed', { error });

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: event.methodArn
          }
        ]
      }
    };
  }
}

export async function apiKeyAuthorizer(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  try {
    const apiKey = event.authorizationToken.replace('ApiKey ', '');
    const isValid = await authService.validateApiKey(apiKey);

    if (!isValid) {
      throw new Error('Invalid API key');
    }

    // Extract developerId from API key (assuming it's encoded in the key)
    const [apiKeyId] = Buffer.from(apiKey, 'base64').toString().split(':');

    logger.info('API key validated', { apiKeyId });

    return {
      principalId: apiKeyId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      },
      context: {
        apiKeyId
      }
    };
  } catch (error) {
    logger.error('API key validation failed', { error });

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: event.methodArn
          }
        ]
      }
    };
  }
}

// Helper function to validate authorization header format
export function validateAuthHeader(authHeader: string | undefined): { type: string; token: string } | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return null;
  }

  const [type, token] = parts;
  if (!['Bearer', 'ApiKey'].includes(type) || !token) {
    return null;
  }

  return { type, token };
}

// Helper function to extract developer ID from JWT
export function extractDeveloperId(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { developerId: string };
    return decoded.developerId;
  } catch {
    return null;
  }
} 