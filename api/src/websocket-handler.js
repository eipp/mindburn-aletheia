const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'mindburn-dev-websocket-connections';

// In-memory demo storage (would use DynamoDB in production)
const demoConnections = [];
const demoSubscriptions = {};

// Main WebSocket handler
exports.handler = async (event) => {
  console.log('WebSocket event', {
    routeKey: event.requestContext.routeKey,
    connectionId: event.requestContext.connectionId,
  });

  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  try {
    // Route to appropriate handler
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event);
      case '$disconnect':
        return await handleDisconnect(event);
      case 'subscribe':
        return await handleSubscribe(event);
      case 'unsubscribe':
        return await handleUnsubscribe(event);
      case 'ping':
        return await handlePing(event);
      default:
        console.warn('Unknown route', { routeKey });
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket handler error', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

// Connect handler
async function handleConnect(event) {
  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const authType = queryParams.auth_type || 'token';
  const authValue = queryParams.token || queryParams.api_key;

  if (!authValue) {
    console.warn('Missing authentication credentials', { connectionId });
    return { statusCode: 401, body: 'Unauthorized: Missing credentials' };
  }

  let developerId;

  // Authenticate based on auth type
  try {
    if (authType === 'token') {
      // Verify JWT token
      const decoded = jwt.verify(authValue, JWT_SECRET);
      developerId = decoded.developerId;
    } else if (authType === 'api_key') {
      // For demo, accept any API key format and extract a demo ID
      developerId = `api-${authValue.substring(0, 8)}`;
    } else {
      console.warn('Unsupported auth type', { connectionId, authType });
      return { statusCode: 401, body: 'Unauthorized: Unsupported auth type' };
    }
  } catch (error) {
    console.warn('Authentication failed', { connectionId, error: error.message });
    return { statusCode: 401, body: 'Unauthorized: Invalid credentials' };
  }

  // Store connection
  const connection = {
    connectionId,
    developerId,
    connectedAt: new Date().toISOString(),
    subscriptions: [],
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
  };

  demoConnections.push(connection);

  console.log('WebSocket connected', { connectionId, developerId });

  return { statusCode: 200, body: 'Connected' };
}

// Disconnect handler
async function handleDisconnect(event) {
  const connectionId = event.requestContext.connectionId;

  // Remove connection
  const connectionIndex = demoConnections.findIndex(conn => conn.connectionId === connectionId);
  if (connectionIndex !== -1) {
    // Clean up subscriptions
    const connection = demoConnections[connectionIndex];
    connection.subscriptions.forEach(subType => {
      if (demoSubscriptions[subType]) {
        const subIndex = demoSubscriptions[subType].findIndex(
          subConn => subConn.connectionId === connectionId
        );
        
        if (subIndex !== -1) {
          demoSubscriptions[subType].splice(subIndex, 1);
        }
      }
    });
    
    // Remove connection
    demoConnections.splice(connectionIndex, 1);
  }

  console.log('WebSocket disconnected', { connectionId });

  return { statusCode: 200, body: 'Disconnected' };
}

// Subscribe handler
async function handleSubscribe(event) {
  const connectionId = event.requestContext.connectionId;
  
  // Parse payload
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    console.warn('Invalid subscription payload', { connectionId, body: event.body });
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON payload' }) };
  }
  
  // Validate subscription type
  if (!payload.type) {
    console.warn('Missing subscription type', { connectionId });
    return { statusCode: 400, body: JSON.stringify({ error: 'Subscription type is required' }) };
  }
  
  // Get connection
  const connection = demoConnections.find(conn => conn.connectionId === connectionId);
  if (!connection) {
    console.warn('Connection not found', { connectionId });
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
    console.warn('Invalid subscription type', { connectionId, type: payload.type });
    return { 
      statusCode: 400, 
      body: JSON.stringify({ 
        error: 'Invalid subscription type', 
        allowedTypes: allowedSubscriptionTypes 
      }) 
    };
  }
  
  // Check if already subscribed
  if (connection.subscriptions.includes(payload.type)) {
    console.info('Already subscribed to type', { connectionId, type: payload.type });
    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: 'Already subscribed to this event type' }) 
    };
  }
  
  // Check subscription limit
  if (connection.subscriptions.length >= 10) {
    console.warn('Subscription limit reached', { connectionId });
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'Maximum subscription limit reached (10)' }) 
    };
  }
  
  // Update subscriptions
  connection.subscriptions.push(payload.type);
  connection.subscriptionFilters = {
    ...connection.subscriptionFilters,
    [payload.type]: payload.filter || {}
  };
  
  // Add to subscription index
  if (!demoSubscriptions[payload.type]) {
    demoSubscriptions[payload.type] = [];
  }
  
  demoSubscriptions[payload.type].push({
    connectionId,
    filter: payload.filter || {},
    developerId: connection.developerId,
    domainName: connection.domainName,
    stage: connection.stage
  });
  
  console.log('Subscription added', { connectionId, type: payload.type });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Subscribed successfully',
      type: payload.type,
      subscriptions: connection.subscriptions
    })
  };
}

// Unsubscribe handler
async function handleUnsubscribe(event) {
  const connectionId = event.requestContext.connectionId;
  
  // Parse payload
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    console.warn('Invalid unsubscription payload', { connectionId, body: event.body });
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON payload' }) };
  }
  
  // Validate subscription type
  if (!payload.type) {
    console.warn('Missing unsubscription type', { connectionId });
    return { statusCode: 400, body: JSON.stringify({ error: 'Subscription type is required' }) };
  }
  
  // Get connection
  const connection = demoConnections.find(conn => conn.connectionId === connectionId);
  if (!connection) {
    console.warn('Connection not found', { connectionId });
    return { statusCode: 404, body: JSON.stringify({ error: 'Connection not found' }) };
  }
  
  // Check if subscribed
  const subIndex = connection.subscriptions.indexOf(payload.type);
  if (subIndex === -1) {
    console.info('Not subscribed to type', { connectionId, type: payload.type });
    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: 'Not subscribed to this event type' }) 
    };
  }
  
  // Update subscriptions
  connection.subscriptions.splice(subIndex, 1);
  
  // Remove from subscription filters
  if (connection.subscriptionFilters) {
    delete connection.subscriptionFilters[payload.type];
  }
  
  // Remove from subscription index
  if (demoSubscriptions[payload.type]) {
    const subConnIndex = demoSubscriptions[payload.type].findIndex(
      subConn => subConn.connectionId === connectionId
    );
    
    if (subConnIndex !== -1) {
      demoSubscriptions[payload.type].splice(subConnIndex, 1);
    }
  }
  
  console.log('Unsubscribed', { connectionId, type: payload.type });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Unsubscribed successfully',
      type: payload.type,
      subscriptions: connection.subscriptions
    })
  };
}

// Ping handler
async function handlePing(event) {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  
  try {
    // Create API Gateway Management API
    const apiGateway = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: `${domainName}/${stage}`
    });
    
    // Send pong message back
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify({ 
        type: 'pong', 
        timestamp: Date.now() 
      })
    }).promise();
    
    console.log('Ping-pong', { connectionId });
    
    return { statusCode: 200, body: 'Pong' };
  } catch (error) {
    console.error('Ping error', { connectionId, error: error.message });
    
    if (error.statusCode === 410) {
      // Connection is gone, cleanup
      await handleDisconnect({ requestContext: { connectionId } });
    }
    
    return { statusCode: 500, body: JSON.stringify({ error: 'Ping failed' }) };
  }
}

// Broadcast handler (for SQS events)
exports.broadcastHandler = async (event) => {
  console.log('WebSocket broadcast handler', { records: event.Records.length });
  
  const results = {
    processed: 0,
    failed: 0,
    sent: 0
  };
  
  // Process each message
  for (const record of event.Records) {
    try {
      // Parse the payload
      const payload = JSON.parse(record.body);
      
      // Validate the payload
      if (!payload.type) {
        console.warn('Invalid payload: missing type', { messageId: record.messageId });
        results.failed++;
        continue;
      }
      
      // Get subscribers for this event type
      const subscribers = demoSubscriptions[payload.type] || [];
      
      console.log('Broadcasting event', { 
        type: payload.type, 
        subscribers: subscribers.length,
        filter: !!payload.filter
      });
      
      // Filter subscribers if filter is provided
      const eligibleSubscribers = payload.filter
        ? subscribers.filter(sub => matchesFilter(payload.filter, sub.filter))
        : subscribers;
      
      if (eligibleSubscribers.length === 0) {
        console.log('No eligible subscribers after filtering', { type: payload.type });
        results.processed++;
        continue;
      }
      
      // Prepare message
      const message = JSON.stringify({
        type: payload.type,
        data: payload.data,
        timestamp: Date.now()
      });
      
      // Group by API gateway endpoint
      const endpointMap = new Map();
      for (const sub of eligibleSubscribers) {
        if (!sub.domainName || !sub.stage) continue;
        
        const endpoint = `${sub.domainName}/${sub.stage}`;
        const connections = endpointMap.get(endpoint) || [];
        connections.push(sub.connectionId);
        endpointMap.set(endpoint, connections);
      }
      
      // Send message to each connection
      let sentCount = 0;
      let failureCount = 0;
      
      for (const [endpoint, connectionIds] of endpointMap.entries()) {
        // Create API Gateway Management API for this endpoint
        const [domainName, stage] = endpoint.split('/');
        const apiGateway = new AWS.ApiGatewayManagementApi({
          apiVersion: '2018-11-29',
          endpoint: `${domainName}/${stage}`
        });
        
        for (const connectionId of connectionIds) {
          try {
            await apiGateway.postToConnection({
              ConnectionId: connectionId,
              Data: message
            }).promise();
            
            sentCount++;
          } catch (error) {
            failureCount++;
            
            if (error.statusCode === 410) {
              // Connection is gone, cleanup
              await handleDisconnect({ requestContext: { connectionId } });
            } else {
              console.error('Failed to send message', { 
                connectionId, 
                error: error.message
              });
            }
          }
        }
      }
      
      results.sent += sentCount;
      results.processed++;
      
      console.log('Broadcast complete', { 
        type: payload.type,
        sent: sentCount,
        failures: failureCount
      });
    } catch (error) {
      console.error('Failed to process broadcast message', { 
        messageId: record.messageId,
        error: error.message
      });
      
      results.failed++;
    }
  }
  
  console.log('WebSocket broadcast processing complete', { 
    total: event.Records.length,
    processed: results.processed,
    failed: results.failed,
    sent: results.sent
  });
  
  // Return results (for logging)
  return results;
};

// Helper function to match filters
function matchesFilter(data, filter) {
  if (!filter || Object.keys(filter).length === 0) {
    return true;
  }
  
  return Object.entries(filter).every(([key, value]) => {
    const dataValue = key.split('.').reduce((obj, k) => obj?.[k], data);
    
    if (dataValue === undefined) {
      return false;
    }
    
    if (typeof value === 'object' && value !== null) {
      return typeof dataValue === 'object' && dataValue !== null && 
             matchesFilter(dataValue, value);
    }
    
    return dataValue === value;
  });
}

// Event sender utility function
exports.sendEvent = async (type, data, filter) => {
  console.log('Sending WebSocket event', { type });
  
  // In a real implementation, this would send to SQS,
  // but for demo purposes we'll directly broadcast to connections
  try {
    // Get subscribers for this event type
    const subscribers = demoSubscriptions[type] || [];
    
    // Filter subscribers if filter is provided
    const eligibleSubscribers = filter
      ? subscribers.filter(sub => matchesFilter(filter, sub.filter))
      : subscribers;
    
    if (eligibleSubscribers.length === 0) {
      console.log('No eligible subscribers', { type });
      return { sent: 0 };
    }
    
    // Prepare message
    const message = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    });
    
    // Send to each connection
    let sentCount = 0;
    
    for (const sub of eligibleSubscribers) {
      try {
        // In a real implementation, this would send via API Gateway Management API
        console.log('Would send to connection', { connectionId: sub.connectionId, type });
        sentCount++;
      } catch (error) {
        console.error('Failed to send message', { 
          connectionId: sub.connectionId, 
          error: error.message
        });
      }
    }
    
    console.log('Event sending complete', { type, sent: sentCount });
    
    return { sent: sentCount };
  } catch (error) {
    console.error('Failed to send event', { type, error: error.message });
    throw error;
  }
}; 