import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Simple handler called', event);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Hello from simple handler',
      receivedData: event.body ? JSON.parse(event.body) : null,
      timestamp: new Date().toISOString()
    })
  };
}; 