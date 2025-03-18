import { Composer } from 'telegraf';
import { WorkerBotContext } from '../types';
import { log } from '../utils/logger';
import { DynamoDBService } from '../services/dynamodb';
import { DynamoDB } from 'aws-sdk';
import { Middleware } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext, WorkerProfile } from '../types';

const db = new DynamoDBService();
const composer = new Composer<WorkerBotContext>();
const logger = createLogger('worker-bot:start-command');

composer.command('start', async ctx => {
  try {
    log.bot.command('start', ctx.from.id.toString());
    const profile = await db.getWorkerProfile(ctx.from.id.toString());

    if (!profile) {
      ctx.session.state = 'REGISTRATION';
      ctx.session.registrationStep = 1;

      return ctx.reply(
        'Welcome to Mindburn Aletheia! 🎉\n\n' +
          "Let's get you started with registration.\n\n" +
          'First, please tell me your preferred language for tasks:\n' +
          '1. English 🇬🇧\n' +
          '2. Spanish 🇪🇸\n' +
          '3. French 🇫🇷\n' +
          '4. German 🇩🇪\n' +
          '5. Other (specify)',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🇬🇧 English', callback_data: 'lang_en' },
                { text: '🇪🇸 Spanish', callback_data: 'lang_es' },
              ],
              [
                { text: '🇫🇷 French', callback_data: 'lang_fr' },
                { text: '🇩🇪 German', callback_data: 'lang_de' },
              ],
              [{ text: '🌐 Other', callback_data: 'lang_other' }],
            ],
          },
        }
      );
    }

    return ctx.reply(
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
            [{ text: '📊 Profile', callback_data: 'view_profile' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

// Registration flow callbacks
composer.action(/^lang_(.+)$/, async ctx => {
  try {
    const language = ctx.match[1];
    ctx.session.data = { ...ctx.session.data, language };
    ctx.session.registrationStep = 2;

    await ctx.editMessageText(
      'Great! Now, what type of tasks are you interested in? (Select all that apply)',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Text', callback_data: 'task_text' },
              { text: '🖼 Images', callback_data: 'task_image' },
            ],
            [
              { text: '🎵 Audio', callback_data: 'task_audio' },
              { text: '🎬 Video', callback_data: 'task_video' },
            ],
            [{ text: '✅ Continue', callback_data: 'tasks_done' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

composer.action(/^task_(.+)$/, async ctx => {
  try {
    const taskType = ctx.match[1];
    const selectedTasks = ctx.session.data?.selectedTasks || [];

    if (!selectedTasks.includes(taskType)) {
      selectedTasks.push(taskType);
    }

    ctx.session.data = { ...ctx.session.data, selectedTasks };
    await ctx.answerCbQuery(`Added ${taskType} tasks to your preferences`);
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

composer.action('tasks_done', async ctx => {
  try {
    if (!ctx.session.data?.selectedTasks?.length) {
      return ctx.answerCbQuery('Please select at least one task type');
    }

    const newProfile = {
      userId: ctx.from.id.toString(),
      telegramId: ctx.from.id,
      username: ctx.from.username,
      language: ctx.session.data.language,
      taskPreferences: ctx.session.data.selectedTasks,
      rating: 0,
      tasksCompleted: 0,
      totalEarned: 0,
      level: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.createWorkerProfile(newProfile);
    ctx.session.state = 'IDLE';

    await ctx.editMessageText(
      '✅ Registration complete!\n\n' +
        "To start earning TON, you'll need to:\n" +
        '1. Connect your TON wallet (/wallet)\n' +
        '2. Complete the training (/training)\n' +
        '3. Start verifying tasks (/tasks)\n\n' +
        'What would you like to do first?',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
            [{ text: '📚 Start Training', callback_data: 'start_training' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

export const startCommand = (dynamodb: DynamoDB.DocumentClient): Middleware<BotContext> => {
  return async (ctx: BotContext) => {
    try {
      const userId = ctx.from?.id.toString();

      if (!userId) {
        await ctx.reply('Error: Could not identify user.');
        return;
      }

      // Check if user already exists
      const existingUser = await dynamodb
        .get({
          TableName: process.env.WORKERS_TABLE!,
          Key: { userId },
        })
        .promise();

      if (existingUser.Item) {
        // User exists - show welcome back message
        const profile = existingUser.Item as WorkerProfile;

        await ctx.reply(
          ctx.i18n.t('welcome.back', {
            username: ctx.from.first_name,
            level: profile.level,
            tasks: profile.tasksCompleted,
            earnings: profile.totalEarned,
          }),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 Available Tasks', callback_data: 'view_tasks' },
                  { text: '👤 My Profile', callback_data: 'view_profile' },
                ],
                [
                  { text: '💰 Wallet', callback_data: 'view_wallet' },
                  { text: '⚙️ Settings', callback_data: 'settings' },
                ],
              ],
            },
          }
        );
        return;
      }

      // New user - create profile
      const newProfile: WorkerProfile = {
        userId,
        username: ctx.from.username,
        status: 'active',
        level: 1,
        rating: 0,
        tasksCompleted: 0,
        totalEarned: 0,
        taskPreferences: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dynamodb
        .put({
          TableName: process.env.WORKERS_TABLE!,
          Item: newProfile,
        })
        .promise();

      // Start registration flow
      await ctx.reply(
        ctx.i18n.t('welcome.new', {
          username: ctx.from.first_name,
        }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎓 Start Training', callback_data: 'start_training' }],
              [{ text: '❓ How it Works', callback_data: 'how_it_works' }],
            ],
          },
        }
      );

      logger.info('New worker registered', { userId });
    } catch (error) {
      logger.error('Start command error:', error);
      await ctx.reply('Sorry, there was an error processing your request. Please try again.', {
        parse_mode: 'HTML',
      });
    }
  };
};

export default composer;
