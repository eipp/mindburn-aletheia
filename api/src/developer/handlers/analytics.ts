import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../../shared';
import * as jwt from 'jsonwebtoken';

const logger = createLogger('DeveloperAnalytics');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const USAGE_TABLE = process.env.USAGE_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

export const getUsageStats: APIGatewayProxyHandler = async (event) => {
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Parse query parameters
    const { startDate, endDate, groupBy = 'day' } = event.queryStringParameters || {};
    
    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required query parameters: startDate, endDate' })
      };
    }
    
    // Format date range for the query
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();
    
    // Query usage data
    const result = await ddb.query({
      TableName: USAGE_TABLE,
      KeyConditionExpression: 'developerId = :devId AND timestamp BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':devId': developerId,
        ':start': start,
        ':end': end
      }
    });
    
    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          developerId,
          startDate,
          endDate,
          data: [] 
        })
      };
    }
    
    // Process and aggregate data based on groupBy parameter
    const aggregatedData = groupByTimeInterval(result.Items, groupBy);
    
    // Calculate summary statistics
    const totalRequests = result.Items.reduce((sum, item) => sum + (item.requestCount || 0), 0);
    const totalTasks = result.Items.reduce((sum, item) => sum + (item.taskCount || 0), 0);
    const successRate = result.Items.reduce((sum, item) => sum + (item.successCount || 0), 0) / totalTasks * 100;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        developerId,
        startDate,
        endDate,
        summary: {
          totalRequests,
          totalTasks,
          successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
          averageResponseTime: calculateAverageResponseTime(result.Items)
        },
        data: aggregatedData
      })
    };
  } catch (error: any) {
    logger.error('Failed to retrieve usage stats', { error: error.message });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const getBillingUsage: APIGatewayProxyHandler = async (event) => {
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const developerId = decoded.developerId;
    
    // Parse query parameters for the billing period
    const { month, year } = event.queryStringParameters || {};
    
    if (!month || !year) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required query parameters: month, year' })
      };
    }
    
    // Calculate the date range for the billing period
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString();
    
    // Query billing data
    const result = await ddb.query({
      TableName: USAGE_TABLE,
      KeyConditionExpression: 'developerId = :devId AND timestamp BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':devId': developerId,
        ':start': startDate,
        ':end': endDate
      }
    });
    
    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          developerId,
          billingPeriod: `${year}-${month}`,
          data: {
            totalTasks: 0,
            totalCost: 0,
            breakdown: []
          }
        })
      };
    }
    
    // Calculate billing information
    const totalTasks = result.Items.reduce((sum, item) => sum + (item.taskCount || 0), 0);
    const breakdown = calculateBillingBreakdown(result.Items);
    const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        developerId,
        billingPeriod: `${year}-${month}`,
        data: {
          totalTasks,
          totalCost,
          breakdown
        }
      })
    };
  } catch (error: any) {
    logger.error('Failed to retrieve billing usage', { error: error.message });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Helper functions
function groupByTimeInterval(items: any[], interval: string) {
  const grouped: { [key: string]: any } = {};
  
  items.forEach(item => {
    let key: string;
    const date = new Date(item.timestamp);
    
    switch (interval) {
      case 'hour':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
        break;
      case 'day':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        break;
      case 'week':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `${startOfWeek.getFullYear()}-${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}-${startOfWeek.getDate().toString().padStart(2, '0')}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        break;
      default:
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
    
    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        requestCount: 0,
        taskCount: 0,
        successCount: 0,
        errorCount: 0,
        responseTime: 0,
        cost: 0
      };
    }
    
    grouped[key].requestCount += (item.requestCount || 0);
    grouped[key].taskCount += (item.taskCount || 0);
    grouped[key].successCount += (item.successCount || 0);
    grouped[key].errorCount += (item.errorCount || 0);
    grouped[key].responseTime += (item.totalResponseTime || 0);
    grouped[key].cost += (item.cost || 0);
  });
  
  // Convert to array and sort by period
  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
}

function calculateAverageResponseTime(items: any[]): number {
  const totalTime = items.reduce((sum, item) => sum + (item.totalResponseTime || 0), 0);
  const totalRequests = items.reduce((sum, item) => sum + (item.requestCount || 0), 0);
  
  return totalRequests > 0 ? Math.round((totalTime / totalRequests) * 100) / 100 : 0;
}

function calculateBillingBreakdown(items: any[]): any[] {
  const breakdown: { [key: string]: any } = {};
  
  items.forEach(item => {
    const taskType = item.taskType || 'unknown';
    
    if (!breakdown[taskType]) {
      breakdown[taskType] = {
        taskType,
        count: 0,
        cost: 0
      };
    }
    
    breakdown[taskType].count += (item.taskCount || 0);
    breakdown[taskType].cost += (item.cost || 0);
  });
  
  return Object.values(breakdown);
} 