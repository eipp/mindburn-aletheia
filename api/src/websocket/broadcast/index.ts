import { SQSHandler } from 'aws-lambda';
import { DynamoDB, ApiGatewayManagementApi } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT!;

interface EventPayload {
  type: string;
  data: any;
  filter?: Record<string, any>;
}

export const handler: SQSHandler = async (event) => {
  const apiGateway = new ApiGatewayManagementApi({
    endpoint: WEBSOCKET_ENDPOINT
  });

  const failedConnections: string[] = [];

  for (const record of event.Records) {
    try {
      const payload: EventPayload = JSON.parse(record.body);

      // Get all connections subscribed to this event type
      const { Items: subscriptions } = await dynamodb.query({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'SubscriptionTypeIndex',
        KeyConditionExpression: 'subscriptionType = :type',
        ExpressionAttributeValues: {
          ':type': payload.type
        }
      }).promise();

      if (!subscriptions?.length) {
        continue;
      }

      // Filter connections based on subscription filters
      const eligibleConnections = subscriptions.filter(sub => {
        if (!sub.filter || Object.keys(sub.filter).length === 0) {
          return true;
        }
        return matchesFilter(payload.data, sub.filter);
      });

      // Broadcast to all eligible connections
      await Promise.all(
        eligibleConnections.map(async (sub) => {
          try {
            await apiGateway.postToConnection({
              ConnectionId: sub.connectionId,
              Data: JSON.stringify({
                type: payload.type,
                data: payload.data
              })
            }).promise();
          } catch (error: any) {
            if (error.statusCode === 410) {
              // Connection is stale
              failedConnections.push(sub.connectionId);
            } else {
              console.error(`Failed to send to connection ${sub.connectionId}:`, error);
            }
          }
        })
      );

      // Cleanup stale connections
      if (failedConnections.length > 0) {
        await Promise.all(
          failedConnections.map(connectionId =>
            dynamodb.delete({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId }
            }).promise()
          )
        );
      }
    } catch (error) {
      console.error('Failed to process event:', error);
      throw error; // Let SQS retry
    }
  }
};

function matchesFilter(data: any, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const dataValue = key.split('.').reduce((obj, k) => obj?.[k], data);
    if (typeof value === 'object' && value !== null) {
      return matchesFilter(dataValue, value);
    }
    return dataValue === value;
  });
} 