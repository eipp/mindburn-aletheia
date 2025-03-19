import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { createLogger } from '../shared';
import * as jwt from 'jsonwebtoken';

const logger = createLogger('WebSocketHandler');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;

// Routes map for WebSocket actions
const routes: Record<string, APIGatewayProxyWebsocketHandlerV2> = {
  $connect: handleConnect,
  $disconnect: handleDisconnect,
  subscribe: handleSubscribe,
  unsubscribe: handleUnsubscribe,
  ping: handlePing,
};

// Main handler that routes WebSocket actions
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  try {
    const routeKey = event.requestContext.routeKey;
    const connectionId = event.requestContext.connectionId;
    
    logger.info('WebSocket event', { 
      routeKey, 
      connectionId, 
      domainName: event.requestContext.domainName 
    });
    
    // Call the appropriate handler based on the route key
    const route = routes[routeKey];
    if (route) {
      return await route(event);
    } else {
      logger.warn('Unknown route', { routeKey });
      return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error: any) {
    logger.error('WebSocket handler error', { error: error.message, stack: error.stack });
    return { statusCode: 500, body: 'Internal server error' };
  }
};

// Connect handler - authenticates and stores connection ID
async function handleConnect(event: any) {
  try {
    const connectionId = event.requestContext.connectionId;
    const queryParams = event.queryStringParameters || {};
    const authType = queryParams.auth_type || 'token';
    let authValue = queryParams.token || queryParams.api_key;
    let developerId: string;
    
    if (!authValue) {
      logger.warn('Missing authentication credentials', { connectionId });
      return { statusCode: 401, body: 'Unauthorized: Missing credentials' };
    }
    
    // Authenticate based on the auth type
    if (authType === 'token') {
      try {
        const decoded = jwt.verify(authValue, JWT_SECRET) as any;
        developerId = decoded.developerId;
      } catch (err) {
        logger.warn('Invalid JWT token', { connectionId, error: err });
        return { statusCode: 401, body: 'Unauthorized: Invalid token' };
      }
    } else if (authType === 'api_key') {
      // Verify API key
      const keyParts = Buffer.from(authValue, 'base64').toString().split(':');
      if (keyParts.length !== 2) {
        return { statusCode: 401, body: 'Unauthorized: Invalid API key format' };
      }
      
      const apiKeyId = keyParts[0];
      const keyResult = await ddb.get({
        TableName: API_KEYS_TABLE,
        Key: { apiKeyId }
      });
      
      if (!keyResult.Item || keyResult.Item.status !== 'active') {
        logger.warn('Invalid or inactive API key', { connectionId, apiKeyId });
        return { statusCode: 401, body: 'Unauthorized: Invalid API key' };
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
    } else {
      logger.warn('Unsupported auth type', { connectionId, authType });
      return { statusCode: 401, body: 'Unauthorized: Unsupported auth type' };
    }
    
    // Store connection data
    await ddb.put({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        developerId,
        connectedAt: new Date().toISOString(),
        subscriptions: [],
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hour TTL
      }
    });
    
    logger.info('WebSocket connected', { connectionId, developerId });
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error: any) {
    logger.error('Connection error', { error: error.message });
    return { statusCode: 500, body: 'Connection failed' };
  }
}

// Disconnect handler - removes connection ID from database
async function handleDisconnect(event: any) {
  try {
    const connectionId = event.requestContext.connectionId;
    
    // Remove connection data
    await ddb.delete({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    });
    
    logger.info('WebSocket disconnected', { connectionId });
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error: any) {
    logger.error('Disconnect error', { error: error.message });
    return { statusCode: 500, body: 'Disconnect failed' };
  }
}

// Subscribe handler - adds event types to connection's subscriptions
async function handleSubscribe(event: any) {
  try {
    const connectionId = event.requestContext.connectionId;
    let payload: { type: string; filter?: Record<string, any> };
    
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (err) {
      logger.warn('Invalid subscription payload', { connectionId, body: event.body });
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON payload' }) };
    }
    
    if (!payload.type) {
      logger.warn('Missing subscription type', { connectionId });
      return { statusCode: 400, body: JSON.stringify({ error: 'Subscription type is required' }) };
    }
    
    // Get current connection
    const { Item: connection } = await ddb.get({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    });
    
    if (!connection) {
      logger.warn('Connection not found', { connectionId });
      return { statusCode: 404, body: JSON.stringify({ error: 'Connection not found' }) };
    }
    
    // Validate allowed subscription types
    const allowedSubscriptionTypes = [
      'TASK_CREATED', 
      'TASK_ASSIGNED', 
      'TASK_COMPLETED',
      'TASK_REJECTED',
      'PAYMENT_PROCESSED'
    ];
    
    if (!allowedSubscriptionTypes.includes(payload.type)) {
      logger.warn('Invalid subscription type', { connectionId, type: payload.type });
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          error: 'Invalid subscription type', 
          allowedTypes: allowedSubscriptionTypes 
        }) 
      };
    }
    
    // Check subscription limit
    const existingSubscriptions = connection.subscriptions || [];
    if (existingSubscriptions.includes(payload.type)) {
      logger.info('Already subscribed to type', { connectionId, type: payload.type });
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: 'Already subscribed to this event type' }) 
      };
    }
    
    if (existingSubscriptions.length >= 10) {
      logger.warn('Subscription limit reached', { connectionId });
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Maximum subscription limit reached (10)' }) 
      };
    }
    
    // Update subscription
    const subscriptions = [...existingSubscriptions, payload.type];
    const filters = {
      ...(connection.subscriptionFilters || {}),
      [payload.type]: payload.filter || {}
    };
    
    await ddb.update({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET subscriptions = :subs, subscriptionFilters = :filters, updatedAt = :now',
      ExpressionAttributeValues: {
        ':subs': subscriptions,
        ':filters': filters,
        ':now': new Date().toISOString()
      }
    });
    
    // Add to subscription by type index
    await ddb.put({
      TableName: CONNECTIONS_TABLE,
      Item: {
        subscriptionType: payload.type,
        connectionId,
        filter: payload.filter || {},
        updatedAt: new Date().toISOString()
      }
    });
    
    logger.info('Subscription added', { connectionId, type: payload.type });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Subscribed successfully',
        type: payload.type,
        subscriptions
      })
    };
  } catch (error: any) {
    logger.error('Subscription error', { error: error.message });
    return { statusCode: 500, body: JSON.stringify({ error: 'Subscription failed' }) };
  }
}

// Unsubscribe handler - removes event types from connection's subscriptions
async function handleUnsubscribe(event: any) {
  try {
    const connectionId = event.requestContext.connectionId;
    let payload: { type: string };
    
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (err) {
      logger.warn('Invalid unsubscription payload', { connectionId, body: event.body });
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON payload' }) };
    }
    
    if (!payload.type) {
      logger.warn('Missing unsubscription type', { connectionId });
      return { statusCode: 400, body: JSON.stringify({ error: 'Subscription type is required' }) };
    }
    
    // Get current connection
    const { Item: connection } = await ddb.get({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    });
    
    if (!connection) {
      logger.warn('Connection not found', { connectionId });
      return { statusCode: 404, body: JSON.stringify({ error: 'Connection not found' }) };
    }
    
    // Check if subscribed
    const existingSubscriptions = connection.subscriptions || [];
    if (!existingSubscriptions.includes(payload.type)) {
      logger.info('Not subscribed to type', { connectionId, type: payload.type });
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: 'Not subscribed to this event type' }) 
      };
    }
    
    // Update subscriptions
    const subscriptions = existingSubscriptions.filter(type => type !== payload.type);
    const filters = { ...connection.subscriptionFilters };
    delete filters[payload.type];
    
    await ddb.update({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET subscriptions = :subs, subscriptionFilters = :filters, updatedAt = :now',
      ExpressionAttributeValues: {
        ':subs': subscriptions,
        ':filters': filters,
        ':now': new Date().toISOString()
      }
    });
    
    // Remove from subscription by type index
    await ddb.delete({
      TableName: CONNECTIONS_TABLE,
      Key: {
        subscriptionType: payload.type,
        connectionId
      }
    });
    
    logger.info('Unsubscribed', { connectionId, type: payload.type });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Unsubscribed successfully',
        type: payload.type,
        subscriptions
      })
    };
  } catch (error: any) {
    logger.error('Unsubscription error', { error: error.message });
    return { statusCode: 500, body: JSON.stringify({ error: 'Unsubscription failed' }) };
  }
}

// Ping handler - keeps connection alive
async function handlePing(event: any) {
  try {
    const connectionId = event.requestContext.connectionId;
    const domainName = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    
    // Create API Gateway Management API client
    const client = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`
    });
    
    // Send pong message back
    await client.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'pong', timestamp: Date.now() })
    }));
    
    logger.debug('Ping-pong', { connectionId });
    
    return { statusCode: 200, body: 'Pong' };
  } catch (error: any) {
    logger.error('Ping error', { error: error.message });
    return { statusCode: 500, body: JSON.stringify({ error: 'Ping failed' }) };
  }
}

// Utility function to broadcast a message to all connections that match a subscription
export async function broadcastToSubscribers(eventType: string, payload: any, filter?: Record<string, any>) {
  try {
    // Query for connections with this subscription
    const { Items: subscriptions } = await ddb.query({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'SubscriptionTypeIndex',
      KeyConditionExpression: 'subscriptionType = :type',
      ExpressionAttributeValues: {
        ':type': eventType
      }
    });
    
    if (!subscriptions || subscriptions.length === 0) {
      logger.info('No subscribers for event', { eventType });
      return { sent: 0, failures: 0 };
    }
    
    // Filter connections based on filter criteria
    const eligibleConnections = filter 
      ? subscriptions.filter(sub => matchesFilter(filter, sub.filter || {}))
      : subscriptions;
    
    if (eligibleConnections.length === 0) {
      logger.info('No matching subscribers after filtering', { eventType });
      return { sent: 0, failures: 0 };
    }
    
    // Get unique domain names and stages for connections (in case they differ)
    const endpointMap = new Map<string, string[]>();
    for (const sub of eligibleConnections) {
      const { domainName, stage } = sub;
      if (!domainName || !stage) continue;
      
      const endpoint = `https://${domainName}/${stage}`;
      const connections = endpointMap.get(endpoint) || [];
      connections.push(sub.connectionId);
      endpointMap.set(endpoint, connections);
    }
    
    // Send message to each connection
    let sentCount = 0;
    let failureCount = 0;
    const message = JSON.stringify({
      type: eventType,
      data: payload,
      timestamp: Date.now()
    });
    
    // Process each endpoint and its connections
    for (const [endpoint, connectionIds] of endpointMap.entries()) {
      const client = new ApiGatewayManagementApiClient({ endpoint });
      
      for (const connectionId of connectionIds) {
        try {
          await client.send(new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: message
          }));
          sentCount++;
        } catch (error: any) {
          failureCount++;
          if (error.statusCode === 410) {
            // Gone - connection is stale, remove it
            await ddb.delete({
              TableName: CONNECTIONS_TABLE,
              Key: { connectionId }
            });
            logger.info('Removed stale connection', { connectionId });
          } else {
            logger.error('Failed to send message', { 
              connectionId, 
              error: error.message, 
              statusCode: error.statusCode 
            });
          }
        }
      }
    }
    
    logger.info('Broadcast complete', { 
      eventType, 
      eligibleConnections: eligibleConnections.length,
      sent: sentCount, 
      failures: failureCount 
    });
    
    return { sent: sentCount, failures: failureCount };
  } catch (error: any) {
    logger.error('Broadcast error', { error: error.message, eventType });
    throw error;
  }
}

// Utility function to match filters
function matchesFilter(data: Record<string, any>, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const dataValue = key.split('.').reduce((obj, k) => obj?.[k], data);
    
    if (dataValue === undefined) {
      return false;
    }
    
    if (typeof value === 'object' && value !== null) {
      return typeof dataValue === 'object' && dataValue !== null && matchesFilter(dataValue, value);
    }
    
    return dataValue === value;
  });
} 