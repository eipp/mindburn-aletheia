import { Context } from 'telegraf';
import { log } from '../utils/logger';

export async function loggingMiddleware(ctx: Context, next: () => Promise<void>) {
  const start = Date.now();
  const userId = ctx.from?.id.toString() || 'unknown';
  
  // Log incoming update
  if ('message' in ctx.update && 'text' in ctx.update.message) {
    log.bot.info('Incoming message', userId, {
      text: ctx.update.message.text,
      chat: ctx.chat?.id
    });
  } else if ('callback_query' in ctx.update) {
    log.bot.info('Callback query', userId, {
      data: ctx.update.callback_query.data,
      message: ctx.update.callback_query.message?.message_id
    });
  }
  
  try {
    // Execute handler
    await next();
    
    // Log execution time
    const ms = Date.now() - start;
    log.bot.info('Response time', userId, {
      ms,
      type: ctx.updateType
    });
  } catch (error) {
    // Log error
    log.bot.error(error, userId, {
      update: ctx.update,
      state: ctx.state
    });
    
    // Rethrow to let error middleware handle it
    throw error;
  }
} 