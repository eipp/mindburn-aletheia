import { Context, Middleware } from 'telegraf';
import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';

const logger = createLogger('worker-bot:auth');

const PUBLIC_COMMANDS = ['/start', '/help'];

export const authMiddleware = (
  dynamodb: DynamoDB.DocumentClient
): Middleware<BotContext> => {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    try {
      // Skip auth for public commands
      if (ctx.message?.text && PUBLIC_COMMANDS.includes(ctx.message.text.split(' ')[0])) {
        return next();
      }

      const userId = ctx.from?.id.toString();
      
      if (!userId) {
        logger.warn('No user ID found in context');
        await ctx.reply('Authentication failed. Please try again.');
        return;
      }

      // Check if user exists in DynamoDB
      const result = await dynamodb.get({
        TableName: process.env.WORKERS_TABLE!,
        Key: { userId }
      }).promise();

      if (!result.Item) {
        logger.warn(`User ${userId} not found in database`);
        await ctx.reply(
          'You need to register first. Please use /start to begin.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Add user data to context
      ctx.state.worker = result.Item;
      
      // Check if worker is banned
      if (result.Item.status === 'banned') {
        logger.warn(`Banned user ${userId} attempted to use bot`);
        await ctx.reply(
          'Your account has been suspended. Please contact support for assistance.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      return next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      await ctx.reply(
        'Authentication error. Please try again later.',
        { parse_mode: 'HTML' }
      );
    }
  };
}; 