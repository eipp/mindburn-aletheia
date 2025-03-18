import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME || '';

interface WebSocketEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
  };
  body?: string;
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event: WebSocketEvent) => {
  const { connectionId, routeKey } = event.requestContext;

  try {
    switch (routeKey) {
      case '$connect':
        await handleConnect(connectionId);
        break;
      case '$disconnect':
        await handleDisconnect(connectionId);
        break;
      case '$default':
        await handleMessage(connectionId, event.body);
        break;
    }

    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(connectionId: string): Promise<void> {
  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: {
      connectionId,
      timestamp: Date.now(),
      status: 'connected',
    },
  }).promise();
}

async function handleDisconnect(connectionId: string): Promise<void> {
  await dynamodb.delete({
    TableName: TABLE_NAME,
    Key: { connectionId },
  }).promise();
}

async function handleMessage(connectionId: string, message?: string): Promise<void> {
  if (!message) return;

  const data = JSON.parse(message);
  
  // Handle different message types
  switch (data.type) {
    case 'task_update':
      await broadcastToWorkers(data);
      break;
    case 'verification_submitted':
      await notifyDeveloper(data);
      break;
    case 'payment_processed':
      await notifyWorker(data);
      break;
  }
}

async function broadcastToWorkers(data: any): Promise<void> {
  const connections = await dynamodb.scan({
    TableName: TABLE_NAME,
    ProjectionExpression: 'connectionId',
  }).promise();

  const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT,
  });

  const message = JSON.stringify({
    type: 'task_update',
    data,
  });

  await Promise.all(
    (connections.Items || []).map(({ connectionId }) =>
      apiGateway
        .postToConnection({
          ConnectionId: connectionId,
          Data: message,
        })
        .promise()
        .catch((error) => {
          if (error.statusCode === 410) {
            return handleDisconnect(connectionId);
          }
          throw error;
        })
    )
  );
}

async function notifyDeveloper(data: any): Promise<void> {
  // Query developers from DynamoDB
  const developers = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'DeveloperIdIndex',
    KeyConditionExpression: 'developer_id = :devId',
    ExpressionAttributeValues: {
      ':devId': data.developer_id,
    },
  }).promise();

  const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT,
  });

  const message = JSON.stringify({
    type: 'verification_submitted',
    data,
  });

  await Promise.all(
    (developers.Items || []).map(({ connectionId }) =>
      apiGateway
        .postToConnection({
          ConnectionId: connectionId,
          Data: message,
        })
        .promise()
        .catch((error) => {
          if (error.statusCode === 410) {
            return handleDisconnect(connectionId);
          }
          throw error;
        })
    )
  );
}

async function notifyWorker(data: any): Promise<void> {
  // Query worker from DynamoDB
  const workers = await dynamodb.query({
    TableName: TABLE_NAME,
    IndexName: 'WorkerIdIndex',
    KeyConditionExpression: 'worker_id = :workerId',
    ExpressionAttributeValues: {
      ':workerId': data.worker_id,
    },
  }).promise();

  const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT,
  });

  const message = JSON.stringify({
    type: 'payment_processed',
    data,
  });

  await Promise.all(
    (workers.Items || []).map(({ connectionId }) =>
      apiGateway
        .postToConnection({
          ConnectionId: connectionId,
          Data: message,
        })
        .promise()
        .catch((error) => {
          if (error.statusCode === 410) {
            return handleDisconnect(connectionId);
          }
          throw error;
        })
    )
  );
}

class ApiGatewayManagementApi {
  private client: AWS.ApiGatewayManagementApi;

  constructor({ endpoint }: { endpoint: string | undefined }) {
    this.client = new AWS.ApiGatewayManagementApi({
      endpoint: endpoint || '',
      apiVersion: '2018-11-29',
    });
  }

  postToConnection({ ConnectionId, Data }: { ConnectionId: string; Data: string }) {
    return this.client.postToConnection({
      ConnectionId,
      Data: Buffer.from(Data),
    });
  }
} 