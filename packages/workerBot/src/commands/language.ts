import { DynamoDB } from 'aws-sdk';
import { Middleware } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';
import { languageCommand } from '../middlewares/i18n';

const logger = createLogger('worker-bot:language-command');

export const languageCommandHandler = (dynamodb: DynamoDB.DocumentClient): Middleware<BotContext> => {
  return async (ctx: BotContext) => {
    try {
      const userId = ctx.from?.id.toString();

      if (!userId) {
        await ctx.reply('Error: Could not identify user.');
        return;
      }

      // Send language selection keyboard
      await ctx.reply(ctx.i18n.t('language.select'), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🇺🇸 English', callback_data: 'language_en' },
              { text: '🇪🇸 Español', callback_data: 'language_es' },
              { text: '🇷🇺 Русский', callback_data: 'language_ru' }
            ]
          ]
        }
      });

      logger.info('Language selection shown', { userId });
    } catch (error) {
      logger.error('Language command error:', error);
      await ctx.reply(
        'Sorry, there was an error processing your language request. Please try again.',
        { parse_mode: 'HTML' }
      );
    }
  };
};

// Handle language selection callbacks
export const handleLanguageCallback = () => async (ctx: BotContext) => {
  try {
    const callbackData = ctx.callbackQuery?.data;
    
    if (!callbackData || !callbackData.startsWith('language_')) {
      return;
    }
    
    // Extract language code
    const language = callbackData.split('_')[1];
    
    // Must answer the callback query to prevent the "loading" state on the button
    await ctx.answerCbQuery();
    
    // Update user's language preference
    await languageCommand(ctx, language);
    
    // Update user's language preference in the database
    const userId = ctx.from?.id.toString();
    if (userId) {
      try {
        await updateUserLanguagePreference(userId, language, ctx);
      } catch (dbError) {
        logger.error('Failed to update language preference in database', {
          userId,
          language,
          error: dbError
        });
      }
    }
  } catch (error) {
    logger.error('Language callback error:', error);
    await ctx.answerCbQuery('Error processing language selection');
  }
};

// Helper to update user's language preference in the database
async function updateUserLanguagePreference(
  userId: string,
  language: string,
  ctx: BotContext
): Promise<void> {
  const dynamodb = ctx.state?.dynamodb as DynamoDB.DocumentClient;
  
  if (!dynamodb) {
    logger.warn('DynamoDB client not available in context');
    return;
  }
  
  try {
    await dynamodb
      .update({
        TableName: process.env.WORKERS_TABLE!,
        Key: { userId },
        UpdateExpression: 'SET preferences.language = :language, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':language': language,
          ':updatedAt': new Date().toISOString()
        }
      })
      .promise();
      
    logger.info('Updated language preference in database', { userId, language });
  } catch (error) {
    logger.error('Database update error:', error);
    throw error;
  }
} 