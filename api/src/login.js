const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';

exports.handler = async (event) => {
  console.log('Login handler called', event);
  
  try {
    if (!event.body) {
      return response(400, { error: 'Missing request body' });
    }

    const data = JSON.parse(event.body);
    
    // Validate required fields
    if (!data.email || !data.password) {
      return response(400, { error: 'Email and password are required' });
    }
    
    // For demo purposes, accept any login but give proper format response
    // In production, you'd verify credentials against database
    
    // Generate a JWT token
    const developerId = 'demo-' + Date.now();
    const token = jwt.sign({ developerId }, JWT_SECRET, { expiresIn: '24h' });
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    console.log('Demo login successful', { email: data.email, developerId });
    
    return response(200, {
      token,
      expiresAt: expiresAt.toISOString(),
      developerId,
      email: data.email,
      firstName: 'Demo',
      lastName: 'User',
      message: 'Demo login successful'
    });
    
  } catch (error) {
    console.error('Error in login handler', error);
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

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