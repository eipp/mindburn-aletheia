import { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';
import { AuthService, AuthConfig } from '../auth/auth';

/**
 * Configuration options for security middleware
 */
export interface SecurityMiddlewareOptions {
  /**
   * Authentication configuration
   */
  authConfig?: AuthConfig;
  
  /**
   * CORS options
   */
  cors?: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposeHeaders: string[];
    maxAge: number;
    allowCredentials: boolean;
  };
  
  /**
   * Content Security Policy options
   */
  csp?: {
    directives: {
      [key: string]: string[];
    };
    reportOnly?: boolean;
    reportUri?: string;
  };
  
  /**
   * Rate limiting options
   */
  rateLimit?: {
    windowMs: number;
    max: number;
    standardHeaders: boolean;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    keyGenerator?: (req: Request) => string;
  };
  
  /**
   * Request body size limit in bytes
   */
  bodyLimit?: number;
  
  /**
   * Disable certain security headers
   */
  disableHeaders?: string[];
  
  /**
   * Enable trusted proxy
   */
  trustProxy?: boolean;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Default security middleware options
 */
const defaultOptions: SecurityMiddlewareOptions = {
  cors: {
    allowedOrigins: [],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-ID'],
    maxAge: 86400,
    allowCredentials: true,
  },
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    },
    reportOnly: false,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  bodyLimit: 1 * 1024 * 1024, // 1MB
  trustProxy: false,
  timeout: 30000, // 30 seconds
};

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Custom CORS middleware
 */
export function corsMiddleware(options: SecurityMiddlewareOptions) {
  const corsOptions = options.cors || defaultOptions.cors;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    // Check if the origin is allowed
    if (origin && corsOptions?.allowedOrigins) {
      const isAllowed = corsOptions.allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin === '*') return true;
        if (allowedOrigin === origin) return true;
        if (allowedOrigin.startsWith('*.') && origin.endsWith(allowedOrigin.slice(1))) return true;
        return false;
      });
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    
    // Set CORS headers
    if (corsOptions?.allowedMethods) {
      res.setHeader('Access-Control-Allow-Methods', corsOptions.allowedMethods.join(', '));
    }
    
    if (corsOptions?.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    }
    
    if (corsOptions?.exposeHeaders) {
      res.setHeader('Access-Control-Expose-Headers', corsOptions.exposeHeaders.join(', '));
    }
    
    if (corsOptions?.maxAge) {
      res.setHeader('Access-Control-Max-Age', corsOptions.maxAge.toString());
    }
    
    if (corsOptions?.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(options: SecurityMiddlewareOptions) {
  const cspOptions = options.csp || defaultOptions.csp;
  const disabledHeaders = options.disableHeaders || [];
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Set default security headers
    if (!disabledHeaders.includes('X-Content-Type-Options')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    if (!disabledHeaders.includes('X-Frame-Options')) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    
    if (!disabledHeaders.includes('X-XSS-Protection')) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    if (!disabledHeaders.includes('Referrer-Policy')) {
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    
    if (!disabledHeaders.includes('Strict-Transport-Security')) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    
    // Set Content-Security-Policy header
    if (cspOptions && !disabledHeaders.includes('Content-Security-Policy')) {
      const directives = Object.entries(cspOptions.directives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');
      
      const headerName = cspOptions.reportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy';
      
      res.setHeader(headerName, directives);
    }
    
    next();
  };
}

/**
 * Simple rate limiting middleware using in-memory store
 * For production, use a more robust solution like Redis
 */
export function rateLimitMiddleware(options: SecurityMiddlewareOptions) {
  const rateLimitOptions = options.rateLimit || defaultOptions.rateLimit;
  const windowMs = rateLimitOptions.windowMs || 15 * 60 * 1000;
  const max = rateLimitOptions.max || 100;
  
  // In-memory store for rate limiting
  const ipRequests: Record<string, { count: number, resetTime: number }> = {};
  
  // Cleanup function to prevent memory leaks
  const cleanup = () => {
    const now = Date.now();
    Object.keys(ipRequests).forEach(key => {
      if (ipRequests[key].resetTime < now) {
        delete ipRequests[key];
      }
    });
  };
  
  // Run cleanup every minute
  setInterval(cleanup, 60 * 1000);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = rateLimitOptions.keyGenerator 
      ? rateLimitOptions.keyGenerator(req) 
      : (req.ip || req.headers['x-forwarded-for'] || 'unknown');
    
    const now = Date.now();
    
    if (!ipRequests[key]) {
      ipRequests[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    // Reset counter if window expired
    if (ipRequests[key].resetTime < now) {
      ipRequests[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    // Increment counter
    ipRequests[key].count += 1;
    
    // Set rate limit headers if enabled
    if (rateLimitOptions.standardHeaders) {
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - ipRequests[key].count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(ipRequests[key].resetTime / 1000).toString());
    }
    
    // Check if rate limit exceeded
    if (ipRequests[key].count > max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
      });
    }
    
    // Skip counter increment based on options
    if (
      (rateLimitOptions.skipSuccessfulRequests && res.statusCode >= 200 && res.statusCode < 300) ||
      (rateLimitOptions.skipFailedRequests && res.statusCode >= 400)
    ) {
      ipRequests[key].count -= 1;
    }
    
    next();
  };
}

/**
 * Request timeout middleware
 */
export function timeoutMiddleware(options: SecurityMiddlewareOptions) {
  const timeout = options.timeout || defaultOptions.timeout;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: 'Request has timed out',
        });
      }
    }, timeout);
    
    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });
    
    next();
  };
}

/**
 * Create all security middlewares
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}) {
  const mergedOptions: SecurityMiddlewareOptions = {
    ...defaultOptions,
    ...options,
    cors: { ...defaultOptions.cors, ...options.cors },
    csp: { 
      ...defaultOptions.csp, 
      ...options.csp,
      directives: { ...defaultOptions.csp?.directives, ...options.csp?.directives }
    },
    rateLimit: { ...defaultOptions.rateLimit, ...options.rateLimit },
  };
  
  const middlewares = [
    requestIdMiddleware,
    corsMiddleware(mergedOptions),
    securityHeadersMiddleware(mergedOptions),
    rateLimitMiddleware(mergedOptions),
  ];
  
  // Add authentication middleware if configured
  if (mergedOptions.authConfig) {
    const authService = new AuthService(mergedOptions.authConfig);
    
    middlewares.push((req: Request, res: Response, next: NextFunction) => {
      const publicPaths = ['/api/public', '/health', '/metrics', '/docs'];
      const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
      
      if (isPublicPath) {
        return next();
      }
      
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      authService.verifyToken(token)
        .then(decodedToken => {
          // Attach user information to request
          (req as any).user = {
            sub: decodedToken.sub,
            username: decodedToken['cognito:username'],
            groups: decodedToken['cognito:groups'] || [],
            email: decodedToken.email,
          };
          next();
        })
        .catch(error => {
          console.error('Auth error:', error);
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        });
    });
  }
  
  // Add timeout middleware if configured
  if (mergedOptions.timeout) {
    middlewares.push(timeoutMiddleware(mergedOptions));
  }
  
  // Return combined middleware
  return (req: Request, res: Response, next: NextFunction) => {
    let currentMiddlewareIndex = 0;
    
    function runNextMiddleware() {
      if (currentMiddlewareIndex >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[currentMiddlewareIndex];
      currentMiddlewareIndex++;
      
      try {
        middleware(req, res, runNextMiddleware);
      } catch (error) {
        next(error);
      }
    }
    
    runNextMiddleware();
  };
} 