import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TaskService } from '../services/task.service';
import { TaskRequestSchema } from '../types/api';
import { createLogger } from '@mindburn/shared';
import { z } from 'zod';

const logger = createLogger('TaskHandler');
const taskService = new TaskService();

export async function submitTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const data = TaskRequestSchema.parse(JSON.parse(event.body));
    const result = await taskService.submitTask(developerId, data);

    return {
      statusCode: 201,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Task submission failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid request data',
          details: error.errors
        })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function getTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const taskId = event.pathParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing task ID' })
      };
    }

    const result = await taskService.getTask(developerId, taskId);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Failed to get task', { error });

    if (error instanceof Error) {
      if (error.message === 'Task not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to task') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function listTasks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const queryParams = event.queryStringParameters || {};
    const params = {
      status: queryParams.status,
      type: queryParams.type,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      nextToken: queryParams.nextToken
    };

    const result = await taskService.listTasks(developerId, params);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    logger.error('Failed to list tasks', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function cancelTask(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const developerId = event.requestContext.authorizer?.developerId;
    if (!developerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const taskId = event.pathParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing task ID' })
      };
    }

    await taskService.cancelTask(developerId, taskId);

    return {
      statusCode: 204,
      body: ''
    };
  } catch (error) {
    logger.error('Failed to cancel task', { error });

    if (error instanceof Error) {
      if (error.message === 'Task not found') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Unauthorized access to task') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: error.message })
        };
      }
      if (error.message === 'Cannot cancel completed or failed tasks') {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

export async function updateTaskStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // This endpoint should only be accessible internally
    const sourceIp = event.requestContext.identity?.sourceIp;
    if (!process.env.ALLOWED_INTERNAL_IPS?.split(',').includes(sourceIp)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    const taskId = event.pathParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing task ID' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const { status, data } = JSON.parse(event.body);
    if (!status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing status' })
      };
    }

    await taskService.updateTaskStatus(taskId, status, data);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Task status updated successfully' })
    };
  } catch (error) {
    logger.error('Failed to update task status', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
} 