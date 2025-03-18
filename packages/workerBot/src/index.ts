import { Telegraf, session } from 'telegraf';
import { DynamoDB, SQS, StepFunctions } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { authMiddleware } from './middlewares/auth';
import { errorHandler } from './middlewares/errorHandler';
import { rateLimiter } from './middlewares/rateLimiter';
import { analyticsMiddleware } from './middlewares/analytics';
import { i18n } from './middlewares/i18n';
import { startCommand } from './commands/start';
import { profileCommand } from './commands/profile';
import { tasksCommand } from './commands/tasks';
import { walletCommand } from './commands/wallet';
import { registerScenes } from './flows';
import { BotContext } from './types';
import { MonitoringService } from './services/monitoring';

const logger = createLogger('worker-bot');

export class WorkerBot {
  private bot: Telegraf<BotContext>;
  private dynamodb: DynamoDB.DocumentClient;
  private sqs: SQS;
  private stepFunctions: StepFunctions;
  private monitoring: MonitoringService;

  constructor() {
    this.dynamodb = new DynamoDB.DocumentClient();
    this.sqs = new SQS();
    this.stepFunctions = new StepFunctions();
    this.monitoring = new MonitoringService();

    this.bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN!);
    
    // Initialize middleware
    this.setupMiddleware();
    
    // Register commands
    this.registerCommands();
    
    // Register scenes for complex flows
    registerScenes(this.bot);
    
    // Setup monitoring
    this.setupMonitoring();
    
    // Error handling
    this.bot.catch(errorHandler);
  }

  private async setupMonitoring(): Promise<void> {
    try {
      await this.monitoring.createCloudWatchAlarms();
      logger.info('Monitoring alarms configured');
    } catch (error) {
      logger.error('Error setting up monitoring:', error);
    }
  }

  private setupMiddleware(): void {
    // Session management
    this.bot.use(session());
    
    // Authentication
    this.bot.use(authMiddleware(this.dynamodb));
    
    // Rate limiting
    this.bot.use(rateLimiter());
    
    // Analytics
    this.bot.use(analyticsMiddleware());
    
    // Localization
    this.bot.use(i18n.middleware());
  }

  private registerCommands(): void {
    // Register command handlers with dependencies
    this.bot.command('start', startCommand(this.dynamodb));
    this.bot.command('profile', profileCommand(this.dynamodb));
    this.bot.command('tasks', tasksCommand(this.dynamodb, this.sqs));
    this.bot.command('wallet', walletCommand(this.dynamodb));
    
    // Help command
    this.bot.help((ctx) => {
      return ctx.reply(ctx.i18n.t('help.message'), {
        parse_mode: 'HTML'
      });
    });
  }

  public async start(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // Webhook setup for production
      this.bot.telegram.setWebhook(process.env.WEBHOOK_URL!);
    } else {
      // Polling for development
      await this.bot.launch();
    }
    
    logger.info('Worker bot started');
  }

  public async handleUpdate(update: any): Promise<void> {
    try {
      await this.bot.handleUpdate(update);
    } catch (error) {
      logger.error('Error handling update:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    await this.bot.stop();
  }
}

// Lambda handler
export const handler = async (event: any): Promise<any> => {
  const bot = new WorkerBot();
  
  try {
    if (event.source === 'serverless-plugin-warmup') {
      return { statusCode: 200, body: 'Warmed up' };
    }

    await bot.handleUpdate(event.body ? JSON.parse(event.body) : event);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' })
    };
  } catch (error) {
    logger.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 