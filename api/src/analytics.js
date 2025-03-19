const jwt = require('jsonwebtoken');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-jwt-secret-key-for-testing-only';

// Get usage statistics handler
exports.getUsageStats = async (event) => {
  console.log('Get usage stats called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // Parse query parameters
    const { startDate, endDate, groupBy = 'day' } = event.queryStringParameters || {};
    
    if (!startDate || !endDate) {
      return response(400, { error: 'Missing required query parameters: startDate, endDate' });
    }
    
    // Format date range for display
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();
    
    // Generate demo usage data
    const usageData = generateDemoUsageData(startDate, endDate, groupBy);
    
    // Calculate summary statistics
    const totalRequests = usageData.reduce((sum, item) => sum + item.requestCount, 0);
    const totalTasks = usageData.reduce((sum, item) => sum + item.taskCount, 0);
    const successCount = usageData.reduce((sum, item) => sum + item.successCount, 0);
    const successRate = totalTasks > 0 ? (successCount / totalTasks) * 100 : 0;
    const totalResponseTime = usageData.reduce((sum, item) => sum + item.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    return response(200, {
      developerId,
      startDate,
      endDate,
      summary: {
        totalRequests,
        totalTasks,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        averageResponseTime: Math.round(averageResponseTime * 100) / 100
      },
      data: usageData
    });
  } catch (error) {
    console.error('Error retrieving usage stats', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get billing usage handler
exports.getBillingUsage = async (event) => {
  console.log('Get billing usage called', { path: event.path });
  
  try {
    // Extract developer ID from JWT token
    const token = event.headers.Authorization?.split(' ')[1];
    if (!token) {
      return response(401, { error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const developerId = decoded.developerId;
    
    console.log('Developer authorized', { developerId });
    
    // Parse query parameters for the billing period
    const { month, year } = event.queryStringParameters || {};
    
    if (!month || !year) {
      return response(400, { error: 'Missing required query parameters: month, year' });
    }
    
    // Generate demo billing data
    const totalTasks = Math.floor(Math.random() * 1000) + 500;
    
    const taskTypes = [
      { type: 'TEXT_VERIFICATION', pricePerTask: 0.01 },
      { type: 'IMAGE_VERIFICATION', pricePerTask: 0.03 },
      { type: 'CODE_VERIFICATION', pricePerTask: 0.05 }
    ];
    
    const breakdown = taskTypes.map(taskType => {
      const count = Math.floor(Math.random() * (totalTasks / 2)) + 50;
      const cost = count * taskType.pricePerTask;
      
      return {
        taskType: taskType.type,
        count,
        cost: Math.round(cost * 100) / 100
      };
    });
    
    const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
    const actualTotalTasks = breakdown.reduce((sum, item) => sum + item.count, 0);
    
    return response(200, {
      developerId,
      billingPeriod: `${year}-${month}`,
      data: {
        totalTasks: actualTotalTasks,
        totalCost: Math.round(totalCost * 100) / 100,
        breakdown
      }
    });
  } catch (error) {
    console.error('Error retrieving billing usage', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return response(401, { error: 'Invalid or expired token' });
    }
    
    return response(500, { 
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Generate demo usage data
function generateDemoUsageData(startDate, endDate, interval) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const data = [];
  
  let current = new Date(start);
  
  while (current <= end) {
    const requestCount = Math.floor(Math.random() * 100) + 50;
    const taskCount = Math.floor(Math.random() * requestCount * 0.8) + 10;
    const successCount = Math.floor(Math.random() * taskCount * 0.9) + Math.floor(taskCount * 0.1);
    const errorCount = taskCount - successCount;
    const responseTime = Math.random() * 200 + 50; // 50-250ms
    
    let periodKey;
    
    switch(interval) {
      case 'hour':
        periodKey = `${current.toISOString().slice(0, 13)}:00`;
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        periodKey = current.toISOString().slice(0, 10);
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        const startOfWeek = new Date(current);
        startOfWeek.setDate(current.getDate() - current.getDay());
        periodKey = startOfWeek.toISOString().slice(0, 10);
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        periodKey = current.toISOString().slice(0, 7);
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        periodKey = current.toISOString().slice(0, 10);
        current.setDate(current.getDate() + 1);
    }
    
    data.push({
      period: periodKey,
      requestCount,
      taskCount,
      successCount,
      errorCount,
      responseTime: Math.round(responseTime * 100) / 100,
      cost: Math.round(taskCount * 0.02 * 100) / 100
    });
  }
  
  return data;
}

// Helper function for consistent responses
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
} 