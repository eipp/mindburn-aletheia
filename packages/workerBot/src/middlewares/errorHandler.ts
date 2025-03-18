import { Context } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';

const logger = createLogger('worker-bot:error-handler');

export const errorHandler = async (error: Error, ctx: BotContext): Promise<void> => {
  try {
    // Log error details
    logger.error('Bot error:', {
      error: {
        message: error.message,
        stack: error.stack
      },
      update: ctx.update,
      userId: ctx.from?.id,
      command: ctx.message?.text
    });

    // Determine error type and send appropriate message
    let errorMessage: string;
    
    if (error.message.includes('Forbidden')) {
      errorMessage = 'Bot lacks necessary permissions. Please ensure the bot has admin rights.';
    } else if (error.message.includes('Too Many Requests')) {
      errorMessage = 'Too many requests. Please try again later.';
    } else if (error.message.includes('Bad Request')) {
      errorMessage = 'Invalid request format. Please try again.';
    } else {
      errorMessage = 'An unexpected error occurred. Our team has been notified.';
    }

    // Send error message to user if possible
    if (ctx.chat) {
      await ctx.reply(errorMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'retry' }],
            [{ text: '❓ Help', callback_data: 'help' }]
          ]
        }
      });
    }

    // Publish error metric
    await ctx.telegram.callApi('sendMessage', {
      chat_id: process.env.ADMIN_CHAT_ID,
      text: `🚨 Bot Error:\n\nUser: ${ctx.from?.id}\nCommand: ${ctx.message?.text}\nError: ${error.message}`,
      parse_mode: 'HTML'
    });
  } catch (handlerError) {
    logger.error('Error handler failed:', handlerError);
  }
}; 