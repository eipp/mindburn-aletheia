import { Composer } from 'telegraf';
import { WorkerBotContext, Task, TaskStatus, TaskType } from '../types';
import { log } from '../utils/logger';
import { DynamoDBService } from '../services/dynamodb';
import { DynamoDB, SQS } from 'aws-sdk';
import { Middleware } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext, TaskDetails, WorkerProfile } from '../types';

const db = new DynamoDBService();
const composer = new Composer<WorkerBotContext>();
const logger = createLogger('worker-bot:tasks-command');

const TASKS_PER_PAGE = 5;

// Helper function to format task message
const formatTaskMessage = (task: Task): string => {
  const typeEmoji = {
    [TaskType.TEXT_VERIFICATION]: '📝',
    [TaskType.IMAGE_VERIFICATION]: '🖼',
    [TaskType.AUDIO_VERIFICATION]: '🎵',
    [TaskType.VIDEO_VERIFICATION]: '🎬',
  };

  return (
    `${typeEmoji[task.type]} Task #${task.id}\n\n` +
    `Type: ${task.type.replace('_', ' ')}\n` +
    `Reward: ${task.reward} TON\n` +
    `Description: ${task.prompt}\n\n` +
    `Status: ${task.status}`
  );
};

composer.command('tasks', async ctx => {
  try {
    log.bot.command('tasks', ctx.from.id.toString());
    const profile = await db.getWorkerProfile(ctx.from.id.toString());

    if (!profile) {
      return ctx.reply('Please use /start to create your profile first.');
    }

    if (!profile.walletAddress) {
      return ctx.reply(
        '⚠️ You need to connect your TON wallet first.\n' + 'Use /wallet to connect your wallet.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }]],
          },
        }
      );
    }

    const availableTasks = await db.getAvailableTasks(profile.taskPreferences);

    if (!availableTasks.length) {
      return ctx.reply(
        'No tasks available at the moment.\n' + "I'll notify you when new tasks arrive! 🔔",
        {
          reply_markup: {
            inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'refresh_tasks' }]],
          },
        }
      );
    }

    // Show first task with navigation
    ctx.session.taskIndex = 0;
    ctx.session.availableTasks = availableTasks;

    const task = availableTasks[0];
    await ctx.reply(formatTaskMessage(task), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Previous', callback_data: 'prev_task' },
            { text: '➡️ Next', callback_data: 'next_task' },
          ],
          [{ text: '✅ Accept Task', callback_data: `accept_task_${task.id}` }],
          [{ text: '🔄 Refresh List', callback_data: 'refresh_tasks' }],
        ],
      },
    });
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

// Task navigation
composer.action('prev_task', async ctx => {
  try {
    const tasks = ctx.session.availableTasks;
    let index = ctx.session.taskIndex;

    if (!tasks?.length) {
      return ctx.answerCbQuery('No tasks available');
    }

    index = index > 0 ? index - 1 : tasks.length - 1;
    ctx.session.taskIndex = index;

    await ctx.editMessageText(formatTaskMessage(tasks[index]), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Previous', callback_data: 'prev_task' },
            { text: '➡️ Next', callback_data: 'next_task' },
          ],
          [{ text: '✅ Accept Task', callback_data: `accept_task_${tasks[index].id}` }],
          [{ text: '🔄 Refresh List', callback_data: 'refresh_tasks' }],
        ],
      },
    });
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error navigating tasks');
  }
});

composer.action('next_task', async ctx => {
  try {
    const tasks = ctx.session.availableTasks;
    let index = ctx.session.taskIndex;

    if (!tasks?.length) {
      return ctx.answerCbQuery('No tasks available');
    }

    index = index < tasks.length - 1 ? index + 1 : 0;
    ctx.session.taskIndex = index;

    await ctx.editMessageText(formatTaskMessage(tasks[index]), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Previous', callback_data: 'prev_task' },
            { text: '➡️ Next', callback_data: 'next_task' },
          ],
          [{ text: '✅ Accept Task', callback_data: `accept_task_${tasks[index].id}` }],
          [{ text: '🔄 Refresh List', callback_data: 'refresh_tasks' }],
        ],
      },
    });
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error navigating tasks');
  }
});

// Task acceptance
composer.action(/^accept_task_(.+)$/, async ctx => {
  try {
    const taskId = ctx.match[1];
    const task = await db.getTask(taskId);

    if (!task || task.status !== TaskStatus.PENDING) {
      return ctx.answerCbQuery('This task is no longer available');
    }

    // Update task status
    await db.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
    ctx.session.currentTaskId = taskId;
    ctx.session.state = 'VERIFYING_TASK';
    ctx.session.verificationStep = 1;

    // Start verification flow
    await ctx.editMessageText(
      `✅ Task accepted!\n\n${formatTaskMessage(task)}\n\n` +
        "Let's start the verification process.\n" +
        "I'll guide you through each step.",
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Start Verification', callback_data: 'start_verification' }],
            [{ text: '❌ Cancel Task', callback_data: 'cancel_task' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error accepting task');
  }
});

// Refresh task list
composer.action('refresh_tasks', async ctx => {
  try {
    const profile = await db.getWorkerProfile(ctx.from.id.toString());
    const availableTasks = await db.getAvailableTasks(profile.taskPreferences);

    if (!availableTasks.length) {
      return ctx.editMessageText(
        'No tasks available at the moment.\n' + "I'll notify you when new tasks arrive! 🔔",
        {
          reply_markup: {
            inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'refresh_tasks' }]],
          },
        }
      );
    }

    ctx.session.taskIndex = 0;
    ctx.session.availableTasks = availableTasks;

    await ctx.editMessageText(formatTaskMessage(availableTasks[0]), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Previous', callback_data: 'prev_task' },
            { text: '➡️ Next', callback_data: 'next_task' },
          ],
          [{ text: '✅ Accept Task', callback_data: `accept_task_${availableTasks[0].id}` }],
          [{ text: '🔄 Refresh List', callback_data: 'refresh_tasks' }],
        ],
      },
    });
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error refreshing tasks');
  }
});

export const tasksCommand = (
  dynamodb: DynamoDB.DocumentClient,
  sqs: SQS
): Middleware<BotContext> => {
  return async (ctx: BotContext) => {
    try {
      const userId = ctx.from?.id.toString();

      if (!userId) {
        await ctx.reply('Error: Could not identify user.');
        return;
      }

      // Get worker profile for task eligibility
      const profileResult = await dynamodb
        .get({
          TableName: process.env.WORKERS_TABLE!,
          Key: { userId },
        })
        .promise();

      if (!profileResult.Item) {
        await ctx.reply('Profile not found. Please use /start to create one.', {
          parse_mode: 'HTML',
        });
        return;
      }

      const profile = profileResult.Item as WorkerProfile;

      // Get available tasks
      const tasksResult = await dynamodb
        .query({
          TableName: process.env.TASKS_TABLE!,
          IndexName: 'StatusIndex',
          KeyConditionExpression: '#status = :status',
          FilterExpression: '#level <= :level',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#level': 'requiredLevel',
          },
          ExpressionAttributeValues: {
            ':status': 'available',
            ':level': profile.level,
          },
          Limit: TASKS_PER_PAGE,
        })
        .promise();

      if (!tasksResult.Items || tasksResult.Items.length === 0) {
        await ctx.reply(ctx.i18n.t('tasks.none_available'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Refresh', callback_data: 'refresh_tasks' }],
              [{ text: '📋 Task History', callback_data: 'view_task_history' }],
            ],
          },
        });
        return;
      }

      const tasks = tasksResult.Items as TaskDetails[];
      let message = ctx.i18n.t('tasks.available_header') + '\n\n';

      tasks.forEach((task, index) => {
        message +=
          ctx.i18n.t('tasks.task_item', {
            index: index + 1,
            type: task.type,
            reward: task.reward.toFixed(2),
            complexity: '⭐'.repeat(task.complexity),
            timeLeft: formatTimeLeft(task.deadline),
          }) + '\n\n';
      });

      const keyboard = tasks.map((task, index) => [
        {
          text: `✅ Accept Task #${index + 1}`,
          callback_data: `accept_task:${task.id}`,
        },
      ]);

      keyboard.push([
        { text: '🔄 Refresh', callback_data: 'refresh_tasks' },
        { text: '📋 History', callback_data: 'view_task_history' },
      ]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });

      logger.info('Tasks listed', { userId, count: tasks.length });
    } catch (error) {
      logger.error('Tasks command error:', error);
      await ctx.reply('Sorry, there was an error retrieving available tasks. Please try again.', {
        parse_mode: 'HTML',
      });
    }
  };
};

function formatTimeLeft(deadline: string): string {
  const timeLeft = new Date(deadline).getTime() - Date.now();
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export default composer;
