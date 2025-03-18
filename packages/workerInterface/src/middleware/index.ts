import { Middleware } from 'telegraf';
import { BotContext } from '../types';
import logger from '../utils/logger';
import { docClient } from '../services/aws';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { TableNames } from '../services/aws';

export const loggerMiddleware: Middleware<BotContext> = async (ctx: BotContext, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  logger.info('Bot request', {
    updateType: ctx.updateType,
    userId: ctx.from?.id,
    username: ctx.from?.username,
    duration: ms,
  });
};

export const authMiddleware: Middleware<BotContext> = async (ctx: BotContext, next) => {
  if (!ctx.from) {
    logger.warn('No user in context');
    return;
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TableNames.USERS,
        Key: { userId: ctx.from.id.toString() },
      })
    );

    if (!result.Item) {
      logger.info('New user detected', { userId: ctx.from.id });
      ctx.session = {
        userId: ctx.from.id.toString(),
        telegramId: ctx.from.id,
        state: 'INITIAL',
        lastActive: Date.now(),
        language: ctx.from.language_code || 'en',
        reputation: 0,
        totalTasks: 0,
        completedTasks: 0,
        earnings: 0,
      };
    }

    await next();
  } catch (error) {
    logger.error('Error in auth middleware', { error });
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
};

export const errorHandler: Middleware<BotContext> = async (ctx: BotContext, next) => {
  try {
    await next();
  } catch (error) {
    logger.error('Unhandled error in bot', { error, userId: ctx.from?.id });
    await ctx.reply('An unexpected error occurred. Our team has been notified.');
  }
};
