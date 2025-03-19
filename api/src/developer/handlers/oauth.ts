import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../../shared';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const logger = createLogger('OAuth2Service');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const JWT_SECRET = process.env.JWT_SECRET!;
const CLIENT_TABLE = process.env.OAUTH_CLIENTS_TABLE!;
const AUTH_CODE_TABLE = process.env.AUTH_CODES_TABLE!;
const TOKEN_TABLE = process.env.OAUTH_TOKENS_TABLE!;

export const authorize: APIGatewayProxyHandler = async (event) => {
  try {
    // Get query parameters
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state
    } = event.queryStringParameters || {};
    
    // Validate required parameters
    if (!response_type || !client_id || !redirect_uri) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }
    
    // Verify client
    const client = await getOAuthClient(client_id);
    if (!client) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid client_id' })
      };
    }
    
    // Verify redirect URI
    if (!client.redirectUris.includes(redirect_uri)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid redirect_uri' })
      };
    }
    
    // Extract token from header
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    // Verify token and extract developer ID
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
    
    // Store auth code
    await ddb.put({
      TableName: AUTH_CODE_TABLE,
      Item: {
        code,
        clientId: client_id,
        developerId,
        redirectUri: redirect_uri,
        scope: scope || 'default',
        state,
        expiresAt,
        issuedAt: Date.now()
      }
    });
    
    logger.info('Generated authorization code', { developerId, clientId: client_id });
    
    // Redirect to the client's redirect URI with the auth code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (state) {
      redirectUrl.searchParams.append('state', state);
    }
    
    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl.toString()
      },
      body: ''
    };
  } catch (error: any) {
    logger.error('Authorization failed', { error: error.message });
    
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

export const token: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }
    
    // Parse request body
    const params = new URLSearchParams(event.body);
    const grantType = params.get('grant_type');
    const clientId = params.get('client_id');
    const clientSecret = params.get('client_secret');
    
    // Validate required parameters
    if (!grantType || !clientId || !clientSecret) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }
    
    // Verify client credentials
    const client = await getOAuthClient(clientId);
    if (!client || client.clientSecret !== clientSecret) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid client credentials' })
      };
    }
    
    let developerId: string;
    let scope: string;
    
    // Process based on grant type
    if (grantType === 'authorization_code') {
      const code = params.get('code');
      const redirectUri = params.get('redirect_uri');
      
      if (!code || !redirectUri) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing required parameters for authorization_code grant' })
        };
      }
      
      // Verify authorization code
      const authCode = await getAuthCode(code);
      if (!authCode || authCode.clientId !== clientId || authCode.redirectUri !== redirectUri || authCode.expiresAt < Date.now()) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid authorization code' })
        };
      }
      
      developerId = authCode.developerId;
      scope = authCode.scope;
      
      // Invalidate used code
      await invalidateAuthCode(code);
    } else if (grantType === 'refresh_token') {
      const refreshToken = params.get('refresh_token');
      
      if (!refreshToken) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing refresh_token' })
        };
      }
      
      // Verify refresh token
      const token = await getRefreshToken(refreshToken);
      if (!token || token.clientId !== clientId || token.expiresAt < Date.now()) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid refresh token' })
        };
      }
      
      developerId = token.developerId;
      scope = token.scope;
      
      // Invalidate used refresh token and generate a new one
      await invalidateRefreshToken(refreshToken);
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unsupported grant_type' })
      };
    }
    
    // Generate access token
    const accessToken = jwt.sign(
      { 
        developerId, 
        scope,
        clientId
      }, 
      JWT_SECRET, 
      { expiresIn: '1h' }
    );
    
    // Generate refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Store refresh token
    await ddb.put({
      TableName: TOKEN_TABLE,
      Item: {
        refreshToken,
        accessToken,
        clientId,
        developerId,
        scope,
        issuedAt: Date.now(),
        expiresAt: refreshTokenExpiresAt
      }
    });
    
    logger.info('Generated OAuth2 tokens', { developerId, clientId });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
        scope
      })
    };
  } catch (error: any) {
    logger.error('Token issuance failed', { error: error.message });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const registerClient: APIGatewayProxyHandler = async (event) => {
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
    
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }
    
    const { name, redirectUris, description } = JSON.parse(event.body);
    
    // Validate required fields
    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid request. Required: name and at least one redirectUri' })
      };
    }
    
    // Generate client credentials
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();
    
    // Store client
    await ddb.put({
      TableName: CLIENT_TABLE,
      Item: {
        clientId,
        clientSecret,
        name,
        description: description || '',
        developerId,
        redirectUris,
        createdAt,
        updatedAt: createdAt
      }
    });
    
    logger.info('Registered OAuth client', { developerId, clientId });
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientSecret,
        name,
        description: description || '',
        redirectUris,
        createdAt
      })
    };
  } catch (error: any) {
    logger.error('Client registration failed', { error: error.message });
    
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

// Helper functions

async function getOAuthClient(clientId: string) {
  const result = await ddb.get({
    TableName: CLIENT_TABLE,
    Key: { clientId }
  });
  
  return result.Item;
}

async function getAuthCode(code: string) {
  const result = await ddb.get({
    TableName: AUTH_CODE_TABLE,
    Key: { code }
  });
  
  return result.Item;
}

async function invalidateAuthCode(code: string) {
  await ddb.update({
    TableName: AUTH_CODE_TABLE,
    Key: { code },
    UpdateExpression: 'SET used = :used',
    ExpressionAttributeValues: {
      ':used': true
    }
  });
}

async function getRefreshToken(refreshToken: string) {
  const result = await ddb.get({
    TableName: TOKEN_TABLE,
    Key: { refreshToken }
  });
  
  return result.Item;
}

async function invalidateRefreshToken(refreshToken: string) {
  await ddb.update({
    TableName: TOKEN_TABLE,
    Key: { refreshToken },
    UpdateExpression: 'SET revoked = :revoked',
    ExpressionAttributeValues: {
      ':revoked': true
    }
  });
} 