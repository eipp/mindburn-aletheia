import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;

interface SubscriptionPayload {
  type: string;
  filter?: Record<string, any>;
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async event => {
  try {
    const connectionId = event.requestContext.connectionId;
    const payload: SubscriptionPayload = JSON.parse(event.body || '{}');

    if (!payload.type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Subscription type is required' }),
      };
    }

    // Get current connection
    const { Item: connection } = await dynamodb
      .get({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
      })
      .promise();

    if (!connection) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Connection not found' }),
      };
    }

    // Update subscriptions
    const subscriptions = new Set([...(connection.subscriptions || [])]);
    subscriptions.add(payload.type);

    await dynamodb
      .update({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'SET subscriptions = :subs, subscriptionFilters = :filters',
        ExpressionAttributeValues: {
          ':subs': Array.from(subscriptions),
          ':filters': {
            ...connection.subscriptionFilters,
            [payload.type]: payload.filter || {},
          },
        },
      })
      .promise();

    // Add to subscription index
    await dynamodb
      .put({
        TableName: CONNECTIONS_TABLE,
        Item: {
          subscriptionType: payload.type,
          connectionId,
          filter: payload.filter || {},
          updatedAt: new Date().toISOString(),
        },
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Subscribed',
        type: payload.type,
      }),
    };
  } catch (error) {
    console.error('Subscription failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to subscribe' }),
    };
  }
};
