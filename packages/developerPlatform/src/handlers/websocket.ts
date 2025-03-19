import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@mindburn/shared';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('WebSocketHandler');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const JWT_SECRET = process.env.JWT_SECRET!;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;

// Connection handler for WebSocket
export async function handleConnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId;
    const queryParams = event.queryStringParameters || {};
    const authType = queryParams.auth_type || 'token';
    const authValue = queryParams.token || queryParams.api_key;
    
    if (!authValue) {
      logger.warn('Missing authentication credentials', { connectionId });
      return { 
        statusCode: 401, 
        body: 'Unauthorized: Missing credentials' 
      };
    }
    
    let developerId: string;
    
    // Authenticate based on auth type
    if (authType === 'token') {
      try {
        const decoded = jwt.verify(authValue, JWT_SECRET) as { developerId: string };
        developerId = decoded.developerId;
      } catch (error) {
        logger.warn('Invalid JWT token', { connectionId, error });
        return { 
          statusCode: 401, 
          body: 'Unauthorized: Invalid token' 
        };
      }
    } else if (authType === 'api_key') {
      try {
        const keyParts = Buffer.from(authValue, 'base64').toString().split(':');
        if (keyParts.length !== 2) {
          return { 
            statusCode: 401, 
            body: 'Unauthorized: Invalid API key format' 
          };
        }
        
        const apiKeyId = keyParts[0];
        const keyResult = await ddb.get({
          TableName: API_KEYS_TABLE,
          Key: { apiKeyId }
        });
        
        if (!keyResult.Item || keyResult.Item.status !== 'active') {
          logger.warn('Invalid or inactive API key', { connectionId, apiKeyId });
          return { 
            statusCode: 401, 
            body: 'Unauthorized: Invalid API key' 
          };
        }
        
        developerId = keyResult.Item.developerId;
        
        // Update last used timestamp
        await ddb.update({
          TableName: API_KEYS_TABLE,
          Key: { apiKeyId },
          UpdateExpression: 'SET lastUsed = :now',
          ExpressionAttributeValues: {
            ':now': new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('API key validation error', { error });
        return { 
          statusCode: 401, 
          body: 'Unauthorized: Invalid API key' 
        };
      }
    } else {
      logger.warn('Unsupported auth type', { connectionId, authType });
      return { 
        statusCode: 401, 
        body: 'Unauthorized: Unsupported auth type' 
      };
    }
    
    // Store connection data with TTL
    await ddb.put({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        developerId,
        connectedAt: new Date().toISOString(),
        subscriptions: [],
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24-hour TTL
      }
    });
    
    logger.info('WebSocket connected', { connectionId, developerId });
    
    return { 
      statusCode: 200, 
      body: 'Connected' 
    };
  } catch (error) {
    logger.error('Connection error', { error });
    return { 
      statusCode: 500, 
      body: 'Connection failed' 
    };
  }
}

// Disconnect handler for WebSocket
export async function handleDisconnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId;
    
    // Remove connection from database
    await ddb.delete({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    });
    
    logger.info('WebSocket disconnected', { connectionId });
    
    return { 
      statusCode: 200, 
      body: 'Disconnected' 
    };
  } catch (error) {
    logger.error('Disconnect error', { error });
    return { 
      statusCode: 500, 
      body: 'Failed to disconnect' 
    };
  }
}

// Message handler for WebSocket
export async function handleMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId;
    
    // Get connection information
    const connectionResult = await ddb.get({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    });
    
    if (!connectionResult.Item) {
      logger.warn('Connection not found', { connectionId });
      return { 
        statusCode: 400, 
        body: 'Invalid connection' 
      };
    }
    
    const connection = connectionResult.Item;
    
    // Parse message
    if (!event.body) {
      return { 
        statusCode: 400, 
        body: 'Missing message body' 
      };
    }
    
    const message = JSON.parse(event.body);
    
    // Handle different message types
    switch (message.action) {
      case 'subscribe':
        await handleSubscription(connectionId, connection.developerId, message);
        break;
      
      case 'unsubscribe':
        await handleUnsubscription(connectionId, message);
        break;
      
      default:
        logger.warn('Unknown message action', { connectionId, action: message.action });
        return { 
          statusCode: 400, 
          body: 'Unknown action' 
        };
    }
    
    return { 
      statusCode: 200, 
      body: 'Message processed' 
    };
  } catch (error) {
    logger.error('Message handling error', { error });
    return { 
      statusCode: 500, 
      body: 'Failed to process message' 
    };
  }
}

// Helper function to handle subscriptions
async function handleSubscription(connectionId: string, developerId: string, message: any): Promise<void> {
  const subscriptionId = uuidv4();
  const subscription = {
    id: subscriptionId,
    type: message.type,
    filter: message.filter || {},
  };
  
  // Update connection with new subscription
  await ddb.update({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: 'SET subscriptions = list_append(if_not_exists(subscriptions, :empty_list), :subscription)',
    ExpressionAttributeValues: {
      ':empty_list': [],
      ':subscription': [subscription],
    },
  });
  
  logger.info('Subscription added', { connectionId, subscriptionId, type: message.type });
  
  // Send confirmation message
  await sendMessage(connectionId, {
    type: 'subscription_confirmed',
    data: {
      id: subscriptionId,
      type: message.type,
    },
  });
}

// Helper function to handle unsubscriptions
async function handleUnsubscription(connectionId: string, message: any): Promise<void> {
  // Get current subscriptions
  const result = await ddb.get({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  });
  
  if (!result.Item || !result.Item.subscriptions) {
    return;
  }
  
  const subscriptions = result.Item.subscriptions;
  const updatedSubscriptions = subscriptions.filter(
    (sub: any) => sub.id !== message.subscriptionId && sub.type !== message.type
  );
  
  // Update connection with filtered subscriptions
  await ddb.update({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: 'SET subscriptions = :subscriptions',
    ExpressionAttributeValues: {
      ':subscriptions': updatedSubscriptions,
    },
  });
  
  logger.info('Subscription removed', { connectionId, type: message.type });
}

// Function to send a message to a specific connection
async function sendMessage(connectionId: string, data: any): Promise<void> {
  try {
    const apiGwManagement = new ApiGatewayManagementApi({
      endpoint: `${process.env.API_GATEWAY_ENDPOINT}/production`,
    });
    
    await apiGwManagement.postToConnection({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    });
  } catch (error) {
    logger.error('Failed to send message', { connectionId, error });
    
    if ((error as any).statusCode === 410) {
      // Connection is stale, remove it
      await ddb.delete({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
      });
    }
    
    throw error;
  }
}

// Function to broadcast analytics updates to subscribers
export async function broadcastAnalyticsUpdate(
  type: string,
  data: any,
  filter?: Record<string, any>
): Promise<void> {
  // Query for connections with matching subscriptions
  const connections = await findConnectionsWithSubscription(type, filter);
  
  // Broadcast to all matching connections
  const message = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };
  
  for (const connection of connections) {
    try {
      await sendMessage(connection.connectionId, message);
    } catch (error) {
      logger.error('Failed to broadcast to connection', {
        connectionId: connection.connectionId,
        error,
      });
    }
  }
}

// Helper function to find connections with matching subscriptions
async function findConnectionsWithSubscription(
  type: string,
  filter?: Record<string, any>
): Promise<Array<{ connectionId: string; developerId: string }>> {
  // This is a simplified implementation - in a real-world scenario,
  // you would use a more efficient query with a GSI on subscription types
  const result = await ddb.scan({
    TableName: CONNECTIONS_TABLE,
  });
  
  const connections = result.Items || [];
  
  return connections.filter((connection) => {
    if (!connection.subscriptions) {
      return false;
    }
    
    return connection.subscriptions.some((sub: any) => {
      if (sub.type !== type) {
        return false;
      }
      
      // If there's a filter, check if it matches
      if (filter && sub.filter) {
        for (const [key, value] of Object.entries(filter)) {
          if (sub.filter[key] !== undefined && sub.filter[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    });
  }).map((connection) => ({
    connectionId: connection.connectionId,
    developerId: connection.developerId,
  }));
} 