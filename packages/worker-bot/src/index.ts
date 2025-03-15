import { Telegraf, session } from 'telegraf';
import { DynamoDBAdapter } from 'telegraf-session-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';
import { WorkerBotContext } from './types';
import { log } from './utils/logger';
import { DynamoDBService } from './services/dynamodb';
import { TonService } from './services/ton';

// Load environment variables
config();

// Initialize services
const db = new DynamoDBService();
const ton = new TonService();

// Initialize bot
const bot = new Telegraf<WorkerBotContext>(process.env.BOT_TOKEN!);

// Session middleware
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const sessionAdapter = new DynamoDBAdapter({
  client: dynamoClient,
  tableName: `${process.env.DYNAMODB_TABLE_PREFIX}${process.env.DYNAMODB_SESSIONS_TABLE}`,
});

bot.use(session({ store: sessionAdapter }));

// Error handling middleware
bot.catch((err, ctx) => {
  log.bot.error(err, ctx.from?.id?.toString() || 'unknown', {
    update: ctx.update,
    state: ctx.state
  });
  
  ctx.reply('Sorry, something went wrong. Please try again later.');
});

// Command handlers
bot.command('start', async (ctx) => {
  try {
    log.bot.command('start', ctx.from.id.toString());

    const profile = await db.getWorkerProfile(ctx.from.id.toString());
    
    if (!profile) {
      // Create new worker profile
      const newProfile = {
        userId: ctx.from.id.toString(),
        telegramId: ctx.from.id,
        username: ctx.from.username,
        rating: 0,
        tasksCompleted: 0,
        totalEarned: 0,
        level: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await db.createWorkerProfile(newProfile);
      
      await ctx.reply(
        'Welcome to Mindburn Aletheia! 🎉\n\n' +
        'I\'m your AI verification assistant. Through me, you can:\n' +
        '• Verify AI outputs and earn TON 💎\n' +
        '• Track your earnings and performance 📊\n' +
        '• Withdraw your earnings to your TON wallet 💰\n\n' +
        'To get started, you\'ll need to connect your TON wallet. Use /wallet to do this.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
              [{ text: '📚 Training', callback_data: 'start_training' }]
            ]
          }
        }
      );
    } else {
      await ctx.reply(
        `Welcome back! 👋\n\n` +
        `Your stats:\n` +
        `• Level: ${profile.level}\n` +
        `• Tasks completed: ${profile.tasksCompleted}\n` +
        `• Total earned: ${profile.totalEarned} TON\n\n` +
        `What would you like to do?`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Available Tasks', callback_data: 'view_tasks' }],
              [{ text: '💰 Wallet', callback_data: 'view_wallet' }],
              [{ text: '📊 Profile', callback_data: 'view_profile' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

bot.command('tasks', async (ctx) => {
  try {
    log.bot.command('tasks', ctx.from.id.toString());
    
    // TODO: Implement task listing logic
    await ctx.reply(
      'Here are the available tasks:\n\n' +
      'Coming soon...',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'refresh_tasks' }]
          ]
        }
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

bot.command('wallet', async (ctx) => {
  try {
    log.bot.command('wallet', ctx.from.id.toString());
    
    const profile = await db.getWorkerProfile(ctx.from.id.toString());
    
    if (!profile?.walletAddress) {
      await ctx.reply(
        'You haven\'t connected your TON wallet yet.\n\n' +
        'To connect your wallet, you can:\n' +
        '1. Use TON Connect in our Mini App 📱\n' +
        '2. Send your wallet address directly 📝\n\n' +
        'Choose an option:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Open Mini App', url: 'https://t.me/MindBurnBot/app' }],
              [{ text: '📝 Send Address', callback_data: 'input_wallet_address' }]
            ]
          }
        }
      );
    } else {
      const balance = await ton.getBalance(profile.walletAddress);
      const transactions = await db.getTransactions(ctx.from.id.toString(), 5);
      
      let transactionsText = transactions.length > 0
        ? transactions.map(t => 
            `• ${t.type}: ${t.amount} TON (${t.status})`
          ).join('\n')
        : 'No recent transactions';
      
      await ctx.reply(
        `💰 Wallet Info\n\n` +
        `Address: \`${profile.walletAddress}\`\n` +
        `Balance: ${balance} TON\n\n` +
        `Recent Transactions:\n${transactionsText}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💸 Withdraw', callback_data: 'withdraw' }],
              [{ text: '📱 Open Mini App', url: 'https://t.me/MindBurnBot/app' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

bot.command('profile', async (ctx) => {
  try {
    log.bot.command('profile', ctx.from.id.toString());
    
    const profile = await db.getWorkerProfile(ctx.from.id.toString());
    
    if (!profile) {
      await ctx.reply('Profile not found. Please use /start to create one.');
      return;
    }
    
    await ctx.reply(
      `📊 Your Profile\n\n` +
      `Level: ${profile.level}\n` +
      `Rating: ⭐️ ${profile.rating}/5\n` +
      `Tasks Completed: ${profile.tasksCompleted}\n` +
      `Total Earned: ${profile.totalEarned} TON\n\n` +
      `Keep up the great work! 🌟`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📈 View Stats', callback_data: 'view_stats' }],
            [{ text: '📱 Open Mini App', url: 'https://t.me/MindBurnBot/app' }]
          ]
        }
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

bot.command('help', async (ctx) => {
  try {
    log.bot.command('help', ctx.from.id.toString());
    
    await ctx.reply(
      '🤖 Available Commands:\n\n' +
      '/start - Start the bot or view main menu\n' +
      '/tasks - View available tasks\n' +
      '/wallet - Manage your TON wallet\n' +
      '/profile - View your profile and stats\n' +
      '/help - Show this help message\n\n' +
      '📱 For the best experience, use our Mini App!',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Open Mini App', url: 'https://t.me/MindBurnBot/app' }]
          ]
        }
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

// Start webhook if in production, otherwise use polling
if (process.env.NODE_ENV === 'production') {
  const domain = process.env.WEBHOOK_DOMAIN;
  const path = process.env.WEBHOOK_PATH;
  const port = parseInt(process.env.PORT || '3000');
  
  bot.launch({
    webhook: {
      domain,
      path,
      port
    }
  }).then(() => {
    log.info(`Bot started with webhook @ ${domain}${path}`);
  });
} else {
  bot.launch().then(() => {
    log.info('Bot started in polling mode');
  });
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 