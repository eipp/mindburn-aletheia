/**
 * API Routes for Developer Platform
 * 
 * This file contains route definitions for all API endpoints
 * in the developer platform.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import * as authHandler from './handlers/auth';
import * as analyticsHandler from './handlers/analytics';
import * as taskHandler from './handlers/task';
import * as webhookHandler from './handlers/webhook';
import * as websocketHandler from './handlers/websocket';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('Routes');

interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  path: string;
  handler: (event: APIGatewayProxyEvent) => Promise<any>;
  needsAuth: boolean;
}

// Define all API routes
export const routes: Route[] = [
  // Auth routes
  {
    method: 'POST',
    path: '/auth/register',
    handler: authHandler.register,
    needsAuth: false,
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: authHandler.login,
    needsAuth: false,
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    handler: authHandler.refreshToken,
    needsAuth: false,
  },
  {
    method: 'GET',
    path: '/auth/validate',
    handler: authHandler.validateToken,
    needsAuth: true,
  },
  {
    method: 'POST',
    path: '/auth/change-password',
    handler: authHandler.changePassword,
    needsAuth: true,
  },
  {
    method: 'POST',
    path: '/auth/reset-password-request',
    handler: authHandler.resetPasswordRequest,
    needsAuth: false,
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    handler: authHandler.resetPassword,
    needsAuth: false,
  },
  {
    method: 'GET',
    path: '/auth/api-keys',
    handler: authHandler.listApiKeys,
    needsAuth: true,
  },
  {
    method: 'POST',
    path: '/auth/api-keys',
    handler: authHandler.generateApiKey,
    needsAuth: true,
  },
  {
    method: 'DELETE',
    path: '/auth/api-keys/{apiKeyId}',
    handler: authHandler.revokeApiKey,
    needsAuth: true,
  },

  // Analytics routes
  {
    method: 'GET',
    path: '/analytics/task-metrics',
    handler: analyticsHandler.getTaskMetrics,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/analytics/billing-metrics',
    handler: analyticsHandler.getBillingMetrics,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/analytics/usage-quota',
    handler: analyticsHandler.getUsageQuota,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/analytics/daily-task-breakdown',
    handler: analyticsHandler.getDailyTaskBreakdown,
    needsAuth: true,
  },
  {
    method: 'POST',
    path: '/analytics/track-usage',
    handler: analyticsHandler.trackUsage,
    needsAuth: false, // Internal endpoint, IP-based auth
  },

  // Task routes (imported from task.ts)
  {
    method: 'POST',
    path: '/tasks',
    handler: taskHandler.createTask,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/tasks',
    handler: taskHandler.listTasks,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/tasks/{taskId}',
    handler: taskHandler.getTask,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/tasks/{taskId}/results',
    handler: taskHandler.getTaskResults,
    needsAuth: true,
  },

  // Webhook routes
  {
    method: 'POST',
    path: '/webhooks',
    handler: webhookHandler.createWebhook,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/webhooks',
    handler: webhookHandler.listWebhooks,
    needsAuth: true,
  },
  {
    method: 'GET',
    path: '/webhooks/{webhookId}',
    handler: webhookHandler.getWebhook,
    needsAuth: true,
  },
  {
    method: 'DELETE',
    path: '/webhooks/{webhookId}',
    handler: webhookHandler.deleteWebhook,
    needsAuth: true,
  },
  {
    method: 'POST',
    path: '/webhooks/{webhookId}/test',
    handler: webhookHandler.testWebhook,
    needsAuth: true,
  },
];

// WebSocket routes (handled differently)
export const websocketRoutes = {
  $connect: websocketHandler.handleConnect,
  $disconnect: websocketHandler.handleDisconnect,
  $default: websocketHandler.handleMessage,
};

// Route matcher
export const routeMatcher = (method: string, path: string): Route | undefined => {
  // Normalize path (remove trailing slash if present and not root)
  const normalizedPath = path !== '/' && path.endsWith('/') 
    ? path.slice(0, -1) 
    : path;
  
  // Find exact match first
  let route = routes.find(r => r.method === method && r.path === normalizedPath);
  
  if (!route) {
    // Try to match routes with path parameters
    route = routes.find(r => {
      if (r.method !== method) return false;
      
      // Convert route path to regex pattern
      const pattern = r.path
        .replace(/{[^/]+}/g, '([^/]+)') // Replace {param} with capture group
        .replace(/\//g, '\\/');         // Escape forward slashes
      
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(normalizedPath);
    });
  }
  
  return route;
};

// Handler function that routes API Gateway requests to the correct handler
export const routeHandler = async (event: APIGatewayProxyEvent) => {
  const { httpMethod, path } = event;
  
  // Handle OPTIONS requests for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      },
      body: '',
    };
  }
  
  // Find matching route
  const route = routeMatcher(httpMethod, path);
  
  if (!route) {
    logger.warn('Route not found', { method: httpMethod, path });
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
    };
  }
  
  // If route requires auth, check for authorization
  if (route.needsAuth && !event.requestContext.authorizer?.developerId) {
    logger.warn('Unauthorized access attempt', { method: httpMethod, path });
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  
  try {
    // Call the route handler
    const result = await route.handler(event);
    
    // Add CORS headers if not present
    if (!result.headers) {
      result.headers = {};
    }
    
    if (!result.headers['Access-Control-Allow-Origin']) {
      result.headers['Access-Control-Allow-Origin'] = '*';
    }
    
    return result;
  } catch (error) {
    logger.error('Route handler error', { error, method: httpMethod, path });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
}; 