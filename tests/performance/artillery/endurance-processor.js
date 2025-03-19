/**
 * Artillery processor for endurance tests
 * 
 * This file contains processing functions used in the endurance testing
 * scenarios to generate dynamic data, preprocess requests, and handle responses.
 */

'use strict';

const crypto = require('crypto');
const LRU = require('lru-cache');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

// Pre-generated cached task IDs
const cachedTaskIds = [];
// In-memory LRU cache for quick lookups with 1000 entry limit and 5-minute TTL
const verificationStatusCache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minute TTL
});

// Initialize cache with some pre-cached task IDs (for simulation)
for (let i = 0; i < 50; i++) {
  const cachedId = `cached-task-${crypto.randomBytes(4).toString('hex')}`;
  cachedTaskIds.push(cachedId);
  verificationStatusCache.set(cachedId, {
    status: 'COMPLETED',
    result: Math.random() > 0.5 ? 'VALID' : 'INVALID',
    confidence: 0.9 + (Math.random() * 0.1), // 0.9-1.0
    processedAt: new Date().toISOString()
  });
}

/**
 * Generate unique task ID for each test iteration
 */
function generateTaskId(userContext, events, done) {
  const uuid = crypto.randomBytes(16).toString('hex');
  userContext.vars.taskId = `task-${uuid}`;
  userContext.vars.timestamp = Date.now();
  
  // 10% chance to use a cached task ID
  if (Math.random() < 0.1 && cachedTaskIds.length > 0) {
    userContext.vars.isCached = true;
    // Add a flag to warm the cache
    userContext.vars.warmCache = true;
  }
  
  return done();
}

/**
 * Handle verification response and prepare for next steps
 */
function handleVerificationResponse(requestParams, response, userContext, events, done) {
  const body = response.body;
  
  // Check if response is valid
  try {
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
    
    if (parsedBody && parsedBody.taskId) {
      // Store task info for later use
      userContext.vars.lastTaskId = parsedBody.taskId;
      userContext.vars.lastTaskStatus = parsedBody.status;
      
      // Log successful verification request
      console.log(`Task created: ${parsedBody.taskId}, Status: ${parsedBody.status}`);
    } else {
      console.log(`Invalid verification response: ${JSON.stringify(parsedBody)}`);
    }
  } catch (error) {
    console.error(`Error parsing verification response: ${error.message}`);
  }
  
  return done();
}

/**
 * Track response times and log issues for troubleshooting
 */
function trackResponseMetrics(requestParams, response, userContext, events, done) {
  const statusCode = response.statusCode;
  const responseTime = response.timings.phases.firstByte;
  
  // Track slow responses for analysis
  if (responseTime > 500) {
    const endpoint = requestParams.url;
    console.warn(`Slow response detected: ${endpoint}, ${responseTime}ms, Code: ${statusCode}`);
  }
  
  // Track errors
  if (statusCode >= 400) {
    const endpoint = requestParams.url;
    console.error(`Request failed: ${endpoint}, Code: ${statusCode}, Body: ${response.body.substring(0, 200)}`);
  }
  
  return done();
}

/**
 * Generate random data options based on request type
 */
function generateRandomOptions(userContext, events, done) {
  // Generate verification type
  const verificationTypes = ['text_verification', 'image_verification', 'code_verification'];
  userContext.vars.verificationType = verificationTypes[Math.floor(Math.random() * verificationTypes.length)];
  
  // Generate priority
  const priorities = ['high', 'medium', 'low'];
  userContext.vars.priority = priorities[Math.floor(Math.random() * priorities.length)];
  
  // Generate confidence threshold
  userContext.vars.confidenceThreshold = (Math.floor(Math.random() * 20) + 80) / 100; // 0.8-0.99
  
  return done();
}

/**
 * Format date strings for reporting
 */
function formatTimestamp(timestamp) {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

// Helper function to get a cached task ID
function getCachedTaskId(userContext, events, done) {
  if (cachedTaskIds.length === 0) {
    // Fallback if no cached tasks
    const uuid = crypto.randomBytes(16).toString('hex');
    userContext.vars.cachedTaskId = `task-${uuid}`;
  } else {
    // Get a random cached task ID
    const randomIndex = Math.floor(Math.random() * cachedTaskIds.length);
    userContext.vars.cachedTaskId = cachedTaskIds[randomIndex];
  }
  return done();
}

// Helper function to check status and retry if needed
function checkAndRetryStatus(userContext, events, done) {
  // Get the captured task ID from previous request
  const taskId = userContext.vars.capturedTaskId;
  
  // Check if we have a cached status
  const cachedStatus = verificationStatusCache.get(taskId);
  if (cachedStatus) {
    // Use cached status - no need to make additional requests
    userContext.vars.cachedStatus = cachedStatus;
    return done();
  }
  
  // Check the current status from the previous request response
  try {
    const lastResponse = events[events.length - 1].response.body;
    const status = typeof lastResponse === 'string' ? 
      JSON.parse(lastResponse).status : 
      lastResponse.status;
    
    // If not completed or failed, we would retry in a real test
    // Artillery handles this via the flow
    if (status === 'COMPLETED' || status === 'FAILED') {
      // Cache the result for future requests
      verificationStatusCache.set(taskId, {
        status,
        processedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    // Ignore parsing errors - will retry anyway
  }
  
  return done();
}

// Re-usable retry logic with backoff
function retryWithBackoff(fn, maxRetries = 3, initialBackoff = 500) {
  return async function(...args) {
    let retries = 0;
    let backoff = initialBackoff;
    
    while (retries < maxRetries) {
      try {
        return await fn(...args);
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 * backoff; // 0-30% jitter
        const delay = backoff + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
        backoff *= 2; // Exponential backoff
      }
    }
  };
}

// Connection optimization
function setupSocketPool(userContext, events, done) {
  // Simulates socket pooling and connection reuse
  userContext.vars.socketPoolSize = 10;
  userContext.vars.keepAliveTimeout = 60000; // 60 seconds
  return done();
}

// Before each request
function beforeRequest(requestParams, userContext, events, done) {
  // Add custom headers for better debugging and caching
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Request-Time'] = Date.now().toString();
  requestParams.headers['X-Cache-Check'] = userContext.vars.isCached ? 'true' : 'false';
  
  // Log request start time for performance tracking
  userContext.vars.requestStartTime = Date.now();
  
  // Add compression if available
  requestParams.gzip = true;
  
  return done();
}

// After each request
function afterResponse(requestParams, response, userContext, events, done) {
  // Calculate request duration
  const duration = Date.now() - userContext.vars.requestStartTime;
  
  // Track slow requests for debugging
  if (duration > 500) { // 500ms threshold
    console.log(`Slow request: ${requestParams.url} - ${duration}ms`);
  }
  
  // Handle caching of verification results
  if (requestParams.url.includes('/status') && response.statusCode === 200) {
    try {
      const body = typeof response.body === 'string' ? 
        JSON.parse(response.body) : 
        response.body;
      
      // If status is terminal, cache it
      if (body.status === 'COMPLETED' || body.status === 'FAILED') {
        const taskId = requestParams.url.split('/').pop().split('?')[0]; // Extract task ID
        verificationStatusCache.set(taskId, body);
        
        // If it's a completely new task, consider adding it to the cached task IDs
        if (body.status === 'COMPLETED' && !cachedTaskIds.includes(taskId) && cachedTaskIds.length < 1000) {
          cachedTaskIds.push(taskId);
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }
  
  return done();
}

module.exports = {
  generateTaskId,
  getCachedTaskId,
  checkAndRetryStatus,
  setupSocketPool,
  beforeRequest,
  afterResponse,
  handleVerificationResponse,
  trackResponseMetrics,
  generateRandomOptions,
  formatTimestamp
}; 