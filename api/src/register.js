const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  console.log('Registration handler called', event);
  
  try {
    if (!event.body) {
      return response(400, { error: 'Missing request body' });
    }

    const data = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ['email', 'password', 'firstName', 'lastName', 'companyName'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return response(400, { 
        error: 'Missing required fields', 
        fields: missingFields 
      });
    }
    
    // Generate demo data
    const developerId = uuidv4();
    const apiKeyId = uuidv4();
    const apiKey = Buffer.from(`${apiKeyId}:${uuidv4()}`).toString('base64');
    const now = new Date().toISOString();
    
    console.log('Demo registration successful', {
      developerId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName
    });
    
    return response(201, {
      developerId,
      email: data.email,
      apiKey,
      createdAt: now,
      message: 'Demo registration successful'
    });
    
  } catch (error) {
    console.error('Error in registration handler', error);
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