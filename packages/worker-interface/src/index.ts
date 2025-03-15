import { Telegraf, session } from 'telegraf';
import { DynamoDBSessionStore } from 'telegraf-session-dynamodb';
import { BotContext } from './types';
import { loggerMiddleware, authMiddleware, errorHandler } from './middleware';
import commandHandlers from './handlers/commands';
import logger from './utils/logger';
import { TableNames } from './services/aws';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserSession } from './types';

// Validate required environment variables
const requiredEnvVars = [
  'BOT_TOKEN',
  'ENVIRONMENT',
  'AWS_REGION',
  'TASK_QUEUE_URL',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize bot
const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

// Session store configuration
const sessionStore = new DynamoDBSessionStore<UserSession>({
  tableName: TableNames.SESSIONS,
  ttl: 30 * 24 * 60 * 60, // 30 days
});

// Middleware
bot.use(session({ store: sessionStore }));
bot.use(loggerMiddleware);
bot.use(authMiddleware);
bot.use(errorHandler);

// Command handlers
bot.use(commandHandlers);

// Error handling
bot.catch((err: unknown, ctx: BotContext) => {
  logger.error('Unhandled bot error', { error: err });
});

// Webhook setup for production
if (process.env.ENVIRONMENT !== 'dev') {
  const domain = process.env.WEBHOOK_DOMAIN;
  const path = `/webhook/${process.env.BOT_TOKEN}`;
  
  bot.telegram.setWebhook(`${domain}${path}`);
  
  // Export handler for AWS Lambda
  export const handler = async (event: APIGatewayProxyEvent) => {
    try {
      const body = JSON.parse(event.body || '{}');
      await bot.handleUpdate(body);
      return { statusCode: 200, body: '' };
    } catch (error) {
      logger.error('Error handling webhook', { error });
      return { statusCode: 500, body: 'Error handling webhook' };
    }
  };
} else {
  // Use polling for development
  bot.launch();
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

logger.info('Bot started', {
  environment: process.env.ENVIRONMENT,
  mode: process.env.ENVIRONMENT === 'dev' ? 'polling' : 'webhook',
});