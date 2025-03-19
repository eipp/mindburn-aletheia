import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async event => {
  try {
    const connectionId = event.requestContext.connectionId;
    const userId = event.requestContext.authorizer?.userId;

    await dynamodb
      .put({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connectionId,
          userId,
          connectedAt: new Date().toISOString(),
          subscriptions: [],
          ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hour TTL
        },
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected' }),
    };
  } catch (error) {
    console.error('Connection failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to connect' }),
    };
  }
};
