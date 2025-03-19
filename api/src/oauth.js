const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';

// In-memory demo storage (would use DynamoDB in production)
const demoOAuthClients = [];
const demoAuthCodes = [];
const demoTokens = [];

// OAuth authorize handler
exports.authorize = async (event) => {
  console.log('OAuth authorize called', { path: event.path });
  
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
      return response(400, { error: 'Missing required parameters' });
    }
    
    // Verify client - for demo, create if not exists
    let client = demoOAuthClients.find(c => c.clientId === client_id);
    if (!client) {
      client = {
        clientId: client_id,
        clientSecret: crypto.randomBytes(16).toString('hex'),
        name: 'Demo Client',
        description: 'Auto-generated demo client',
        redirectUris: [redirect_uri],
        createdAt: new Date().toISOString()
      };
      demoOAuthClients.push(client);
    } else if (!client.redirectUris.includes(redirect_uri)) {
      return response(400, { error: 'Invalid redirect_uri' });
    }
    
    // Extract token from header
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    // Verify token and extract developer ID
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId, clientId: client_id });
    
    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
    
    // Store auth code
    demoAuthCodes.push({
      code,
      clientId: client_id,
      developerId,
      redirectUri: redirect_uri,
      scope: scope || 'default',
      state,
      expiresAt,
      issuedAt: Date.now(),
      used: false
    });
    
    console.log('Generated authorization code', { code: code.substring(0, 8) + '...' });
    
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
  } catch (error) {
    console.error('Authorization failed', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// OAuth token handler
exports.token = async (event) => {
  console.log('OAuth token called', { path: event.path });
  
  try {
    if (!event.body) {
      return response(400, { error: 'Missing request body' });
    }
    
    // Parse request body
    const params = new URLSearchParams(event.body);
    const grantType = params.get('grant_type');
    const clientId = params.get('client_id');
    const clientSecret = params.get('client_secret');
    
    // Validate required parameters
    if (!grantType || !clientId || !clientSecret) {
      return response(400, { error: 'Missing required parameters' });
    }
    
    // Verify client credentials
    const client = demoOAuthClients.find(c => c.clientId === clientId);
    if (!client || client.clientSecret !== clientSecret) {
      return response(401, { error: 'Invalid client credentials' });
    }
    
    let developerId;
    let scope;
    
    // Process based on grant type
    if (grantType === 'authorization_code') {
      const code = params.get('code');
      const redirectUri = params.get('redirect_uri');
      
      if (!code || !redirectUri) {
        return response(400, { error: 'Missing required parameters for authorization_code grant' });
      }
      
      // Verify authorization code
      const authCode = demoAuthCodes.find(c => c.code === code);
      if (!authCode || 
          authCode.clientId !== clientId || 
          authCode.redirectUri !== redirectUri || 
          authCode.expiresAt < Date.now() ||
          authCode.used) {
        return response(400, { error: 'Invalid authorization code' });
      }
      
      developerId = authCode.developerId;
      scope = authCode.scope;
      
      // Invalidate used code
      authCode.used = true;
    } else if (grantType === 'refresh_token') {
      const refreshToken = params.get('refresh_token');
      
      if (!refreshToken) {
        return response(400, { error: 'Missing refresh_token' });
      }
      
      // Verify refresh token
      const token = demoTokens.find(t => t.refreshToken === refreshToken);
      if (!token || token.clientId !== clientId || token.expiresAt < Date.now() || token.revoked) {
        return response(400, { error: 'Invalid refresh token' });
      }
      
      developerId = token.developerId;
      scope = token.scope;
      
      // Invalidate used refresh token
      token.revoked = true;
    } else {
      return response(400, { error: 'Unsupported grant_type' });
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
    demoTokens.push({
      refreshToken,
      accessToken,
      clientId,
      developerId,
      scope,
      issuedAt: Date.now(),
      expiresAt: refreshTokenExpiresAt,
      revoked: false
    });
    
    console.log('Generated OAuth2 tokens', { 
      developerId, 
      clientId,
      accessToken: accessToken.substring(0, 10) + '...' 
    });
    
    return response(200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      refresh_token: refreshToken,
      scope
    });
  } catch (error) {
    console.error('Token issuance failed', error);
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Register OAuth client handler
exports.registerClient = async (event) => {
  console.log('Register OAuth client called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // Parse request body
    if (!event.body) {
      return response(400, { error: 'Missing request body' });
    }
    
    const { name, redirectUris, description } = JSON.parse(event.body);
    
    // Validate required fields
    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return response(400, { error: 'Invalid request. Required: name and at least one redirectUri' });
    }
    
    // Generate client credentials
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();
    
    // Store client
    const newClient = {
      clientId,
      clientSecret,
      name,
      description: description || '',
      developerId,
      redirectUris,
      createdAt,
      updatedAt: createdAt
    };
    
    demoOAuthClients.push(newClient);
    
    console.log('Registered OAuth client', { clientId, developerId });
    
    return response(201, {
      clientId,
      clientSecret,
      name,
      description: description || '',
      redirectUris,
      createdAt
    });
  } catch (error) {
    console.error('Client registration failed', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Helper function for consistent responses
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
} 