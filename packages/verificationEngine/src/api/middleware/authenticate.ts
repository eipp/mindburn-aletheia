import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '@mindburn/shared';
import { config } from '../../config';

const logger = createLogger('authenticate');

interface JWTPayload {
  workerId: string;
  role: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        workerId: string;
        role: string;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    try {
      const decoded = jwt.verify(token, config.security.jwtSecret) as JWTPayload;

      // Check token expiration
      if (Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({ error: 'Token has expired' });
      }

      // Attach user info to request
      req.user = {
        workerId: decoded.workerId,
        role: decoded.role,
      };

      // Check if user is accessing their own resources
      const requestedWorkerId = req.params.workerId;
      if (requestedWorkerId && decoded.role !== 'admin' && decoded.workerId !== requestedWorkerId) {
        logger.warn('Unauthorized access attempt', {
          requestedWorkerId,
          userId: decoded.workerId,
        });
        return res.status(403).json({ error: 'Unauthorized access' });
      }

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token', { error: error.message });
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error', { error });
    next(error);
  }
};
