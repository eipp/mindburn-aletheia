import { Middleware } from 'telegraf';
import Redis from 'ioredis';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';

const logger = createLogger('worker-bot:rate-limiter');

// Rate limit configuration
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 30  // Maximum requests per window
};

const redis = new Redis(process.env.REDIS_URL!);

export const rateLimiter = (): Middleware<BotContext> => {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    try {
      const userId = ctx.from?.id.toString();
      
      if (!userId) {
        return next();
      }

      const key = `rate_limit:${userId}`;
      
      // Get current count
      const count = await redis.incr(key);
      
      // Set expiry on first request
      if (count === 1) {
        await redis.pexpire(key, RATE_LIMIT.WINDOW_MS);
      }

      if (count > RATE_LIMIT.MAX_REQUESTS) {
        logger.warn(`Rate limit exceeded for user ${userId}`);
        await ctx.reply(
          'You are sending too many requests. Please wait a moment before trying again.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      return next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // On Redis error, allow request to proceed
      return next();
    }
  };
}; 