const jwt = require('jsonwebtoken');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';

// JWT authorizer handler
exports.jwtAuthorizer = async (event) => {
  console.log('JWT Authorizer called');
  
  try {
    // Extract token from Authorization header
    const token = event.authorizationToken.replace('Bearer ', '');
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    // Check token expiry
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTimestamp) {
      console.warn('Token expired', { developerId });
      throw new Error('Token expired');
    }
    
    console.log('Authorization successful', { developerId });
    
    // Return policy document
    return generatePolicy(developerId, 'Allow', event.methodArn, { developerId });
  } catch (error) {
    console.error('Authorization failed', error);
    throw new Error('Unauthorized'); // Return a 401 response
  }
};

// Generate IAM policy document
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context
  };
  
  return authResponse;
} 