import { Scenes } from 'telegraf';
import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';

const logger = createLogger('worker-bot:registration-flow');

const TRAINING_TASKS = [
  {
    id: 'training_1',
    type: 'text',
    description: 'Identify the sentiment of this text: "I love this product!"',
    answer: 'positive',
  },
  {
    id: 'training_2',
    type: 'image',
    description: 'Is this image appropriate for all ages?',
    answer: 'yes',
  },
  {
    id: 'training_3',
    type: 'text',
    description: 'Classify this content: "Buy cheap watches here!"',
    answer: 'spam',
  },
];

export const registrationScene = new Scenes.WizardScene<BotContext>(
  'registration',
  // Step 1: Welcome and Terms
  async ctx => {
    try {
      await ctx.reply(
        ctx.i18n.t('registration.welcome', {
          username: ctx.from.first_name,
        }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📜 View Terms', callback_data: 'view_terms' }],
              [{ text: '✅ Accept & Continue', callback_data: 'accept_terms' }],
            ],
          },
        }
      );
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration welcome error:', error);
      await ctx.reply('Error starting registration. Please try /start again.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Task Preferences
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data === 'view_terms') {
        await ctx.reply(ctx.i18n.t('registration.terms'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '✅ Accept & Continue', callback_data: 'accept_terms' }]],
          },
        });
        return;
      }

      if (ctx.callbackQuery.data === 'accept_terms') {
        await ctx.reply(ctx.i18n.t('registration.task_preferences'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📝 Text', callback_data: 'pref_text' },
                { text: '🖼 Images', callback_data: 'pref_image' },
              ],
              [
                { text: '🎵 Audio', callback_data: 'pref_audio' },
                { text: '🎬 Video', callback_data: 'pref_video' },
              ],
              [{ text: '✅ Continue', callback_data: 'prefs_done' }],
            ],
          },
        });
        ctx.session.data = { preferences: [] };
        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Task preferences error:', error);
      await ctx.reply('Error setting preferences. Please try /start again.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Training
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data.startsWith('pref_')) {
        const pref = ctx.callbackQuery.data.replace('pref_', '');
        if (!ctx.session.data.preferences.includes(pref)) {
          ctx.session.data.preferences.push(pref);
        }
        await ctx.answerCbQuery(`Added ${pref} preference`);
        return;
      }

      if (ctx.callbackQuery.data === 'prefs_done') {
        if (ctx.session.data.preferences.length === 0) {
          await ctx.reply('Please select at least one task preference.');
          return;
        }

        await ctx.reply(ctx.i18n.t('registration.training_start'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🎓 Start Training', callback_data: 'start_training' }]],
          },
        });
        ctx.session.data.trainingStep = 0;
        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Training setup error:', error);
      await ctx.reply('Error starting training. Please try /start again.');
      return ctx.scene.leave();
    }
  },
  // Step 4: Training Tasks
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (
        ctx.callbackQuery.data === 'start_training' ||
        ctx.callbackQuery.data.startsWith('answer_')
      ) {
        const step = ctx.session.data.trainingStep;

        if (ctx.callbackQuery.data.startsWith('answer_')) {
          const answer = ctx.callbackQuery.data.replace('answer_', '');
          const isCorrect = answer === TRAINING_TASKS[step - 1].answer;

          if (!isCorrect) {
            await ctx.reply(ctx.i18n.t('registration.incorrect_answer'), {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '🔄 Try Again', callback_data: 'start_training' }]],
              },
            });
            return;
          }
        }

        if (step >= TRAINING_TASKS.length) {
          // Training complete
          await ctx.reply(ctx.i18n.t('registration.training_complete'), {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎉 Complete Registration', callback_data: 'complete_registration' }],
              ],
            },
          });
          return ctx.wizard.next();
        }

        // Show next training task
        const task = TRAINING_TASKS[step];
        await ctx.reply(
          ctx.i18n.t('registration.training_task', {
            step: step + 1,
            total: TRAINING_TASKS.length,
            description: task.description,
          }),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👍 Positive', callback_data: 'answer_positive' },
                  { text: '👎 Negative', callback_data: 'answer_negative' },
                ],
                [
                  { text: '🚫 Spam', callback_data: 'answer_spam' },
                  { text: '✅ Safe', callback_data: 'answer_yes' },
                ],
              ],
            },
          }
        );
        ctx.session.data.trainingStep++;
      }
    } catch (error) {
      logger.error('Training task error:', error);
      await ctx.reply('Error during training. Please try /start again.');
      return ctx.scene.leave();
    }
  },
  // Step 5: Complete Registration
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data || ctx.callbackQuery.data !== 'complete_registration') {
        return;
      }

      const userId = ctx.from?.id.toString();
      if (!userId) {
        throw new Error('No user ID found');
      }

      // Update worker profile with preferences
      const dynamodb = new DynamoDB.DocumentClient();
      await dynamodb
        .update({
          TableName: process.env.WORKERS_TABLE!,
          Key: { userId },
          UpdateExpression: 'SET taskPreferences = :prefs, trainingCompleted = :completed',
          ExpressionAttributeValues: {
            ':prefs': ctx.session.data.preferences,
            ':completed': true,
          },
        })
        .promise();

      await ctx.reply(ctx.i18n.t('registration.complete'), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View Available Tasks', callback_data: 'view_tasks' }],
            [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
          ],
        },
      });

      logger.info('Registration completed', {
        userId,
        preferences: ctx.session.data.preferences,
      });

      return ctx.scene.leave();
    } catch (error) {
      logger.error('Registration completion error:', error);
      await ctx.reply('Error completing registration. Please try /start again.');
      return ctx.scene.leave();
    }
  }
);
