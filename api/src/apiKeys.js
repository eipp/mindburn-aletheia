const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';
const API_KEYS_TABLE = process.env.API_KEYS_TABLE || 'mindburn-dev-api-keys';

// In-memory demo storage (would use DynamoDB in production)
const demoApiKeys = [];

// List API keys handler
exports.listApiKeys = async (event) => {
  console.log('List API keys called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // For demo purposes, generate some API keys if none exist
    if (demoApiKeys.length === 0) {
      for (let i = 0; i < 2; i++) {
        const apiKeyId = uuidv4();
        demoApiKeys.push({
          apiKeyId,
          developerId,
          status: 'active',
          createdAt: new Date(Date.now() - i * 86400000).toISOString(),
          lastUsed: i === 0 ? new Date().toISOString() : null,
          expiresAt: null
        });
      }
    }
    
    // Filter API keys for this developer
    const apiKeys = demoApiKeys
      .filter(key => key.developerId === developerId)
      .map(({ apiKeyId, status, createdAt, lastUsed, expiresAt }) => ({
        apiKeyId,
        status,
        createdAt,
        lastUsed,
        expiresAt
      }));
    
    return response(200, { apiKeys });
  } catch (error) {
    console.error('Error listing API keys', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Generate API key handler
exports.generateApiKey = async (event) => {
  console.log('Generate API key called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // Generate a new API key
    const apiKeyId = uuidv4();
    const apiKey = Buffer.from(`${apiKeyId}:${uuidv4()}`).toString('base64');
    
    // Store API key
    demoApiKeys.push({
      apiKeyId,
      developerId,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      expiresAt: null
    });
    
    console.log('API key generated', { apiKeyId, developerId });
    
    return response(201, { apiKey });
  } catch (error) {
    console.error('Error generating API key', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Revoke API key handler
exports.revokeApiKey = async (event) => {
  console.log('Revoke API key called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // Get API key ID from path parameters
    const apiKeyId = event.pathParameters?.apiKeyId;
    if (!apiKeyId) {
      return response(400, { error: 'Missing API key ID' });
    }
    
    // Find the API key
    const keyIndex = demoApiKeys.findIndex(
      key => key.apiKeyId === apiKeyId && key.developerId === developerId
    );
    
    if (keyIndex === -1) {
      return response(404, { error: 'API key not found' });
    }
    
    // Revoke the API key
    demoApiKeys[keyIndex].status = 'revoked';
    
    console.log('API key revoked', { apiKeyId, developerId });
    
    return response(200, { success: true });
  } catch (error) {
    console.error('Error revoking API key', error);
    
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