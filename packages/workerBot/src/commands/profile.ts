import { DynamoDB } from 'aws-sdk';
import { Middleware } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext, WorkerProfile, WorkerStats } from '../types';

const logger = createLogger('worker-bot:profile-command');

export const profileCommand = (dynamodb: DynamoDB.DocumentClient): Middleware<BotContext> => {
  return async (ctx: BotContext) => {
    try {
      const userId = ctx.from?.id.toString();

      if (!userId) {
        await ctx.reply('Error: Could not identify user.');
        return;
      }

      // Get worker profile and stats
      const [profileResult, statsResult] = await Promise.all([
        dynamodb
          .get({
            TableName: process.env.WORKERS_TABLE!,
            Key: { userId },
          })
          .promise(),
        dynamodb
          .get({
            TableName: process.env.WORKER_STATS_TABLE!,
            Key: { userId },
          })
          .promise(),
      ]);

      if (!profileResult.Item) {
        await ctx.reply('Profile not found. Please use /start to create one.', {
          parse_mode: 'HTML',
        });
        return;
      }

      const profile = profileResult.Item as WorkerProfile;
      const stats = (statsResult.Item as WorkerStats) || {
        tasksToday: 0,
        tasksWeek: 0,
        tasksMonth: 0,
        earningsToday: 0,
        earningsWeek: 0,
        earningsMonth: 0,
        experience: 0,
        nextLevelThreshold: 1000,
      };

      // Calculate level progress
      const levelProgress = Math.round((stats.experience / stats.nextLevelThreshold) * 100);
      const progressBar = generateProgressBar(levelProgress);

      await ctx.reply(
        ctx.i18n.t('profile.details', {
          username: ctx.from.first_name,
          level: profile.level,
          rating: '⭐'.repeat(Math.round(profile.rating)),
          progress: progressBar,
          progressPercent: levelProgress,
          tasksToday: stats.tasksToday,
          tasksWeek: stats.tasksWeek,
          tasksTotal: profile.tasksCompleted,
          earningsToday: stats.earningsToday.toFixed(2),
          earningsWeek: stats.earningsWeek.toFixed(2),
          earningsTotal: profile.totalEarned.toFixed(2),
        }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📈 Detailed Stats', callback_data: 'view_detailed_stats' },
                { text: '🏆 Achievements', callback_data: 'view_achievements' },
              ],
              [
                { text: '⚙️ Settings', callback_data: 'settings' },
                { text: '📋 Task History', callback_data: 'view_task_history' },
              ],
            ],
          },
        }
      );

      logger.info('Profile viewed', { userId });
    } catch (error) {
      logger.error('Profile command error:', error);
      await ctx.reply('Sorry, there was an error retrieving your profile. Please try again.', {
        parse_mode: 'HTML',
      });
    }
  };
};

function generateProgressBar(percent: number): string {
  const filledBlocks = Math.round(percent / 10);
  const emptyBlocks = 10 - filledBlocks;
  return '█'.repeat(filledBlocks) + '▒'.repeat(emptyBlocks);
}
