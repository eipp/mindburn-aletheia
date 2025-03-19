import { APIGatewayProxyHandler } from 'aws-lambda';
import { createLogger } from '../../shared';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('ApiKeyManager');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const JWT_SECRET = process.env.JWT_SECRET!;
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;

export const listApiKeys: APIGatewayProxyHandler = async (event) => {
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Query API keys for this developer
    const result = await ddb.query({
      TableName: API_KEYS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: 'developerId = :developerId',
      ExpressionAttributeValues: {
        ':developerId': developerId,
      },
    });
    
    // Format results
    const apiKeys = result.Items?.map(item => ({
      apiKeyId: item.apiKeyId,
      lastUsed: item.lastUsed,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      status: item.status,
    })) || [];
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKeys })
    };
  } catch (error: any) {
    logger.error('Failed to list API keys', { error: error.message });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const generateApiKey: APIGatewayProxyHandler = async (event) => {
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Generate new API key
    const apiKeyId = uuidv4();
    const apiKey = Buffer.from(`${apiKeyId}:${uuidv4()}`).toString('base64');
    const now = new Date().toISOString();
    
    // Store API key
    await ddb.put({
      TableName: API_KEYS_TABLE,
      Item: {
        apiKeyId,
        apiKeyHash: await bcrypt.hash(apiKey, 10),
        developerId,
        status: 'active',
        createdAt: now,
        lastUsed: null,
        expiresAt: null,
      }
    });
    
    logger.info('Generated new API key', { developerId, apiKeyId });
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    };
  } catch (error: any) {
    logger.error('Failed to generate API key', { error: error.message });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const revokeApiKey: APIGatewayProxyHandler = async (event) => {
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Get API key ID from request
    const apiKeyId = event.pathParameters?.apiKeyId;
    if (!apiKeyId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing API key ID' })
      };
    }
    
    // Get the API key to verify ownership
    const result = await ddb.get({
      TableName: API_KEYS_TABLE,
      Key: { apiKeyId },
    });
    
    if (!result.Item || result.Item.developerId !== developerId) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'API key not found' })
      };
    }
    
    // Revoke the API key
    await ddb.update({
      TableName: API_KEYS_TABLE,
      Key: { apiKeyId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'revoked',
        ':now': new Date().toISOString(),
      },
    });
    
    logger.info('API key revoked', { apiKeyId });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (error: any) {
    logger.error('Failed to revoke API key', { error: error.message });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 