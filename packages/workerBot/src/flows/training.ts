import { Composer } from 'telegraf';
import { WorkerBotContext, TaskType } from '../types';
import { log } from '../utils/logger';
import { DynamoDBService } from '../services/dynamodb';

const db = new DynamoDBService();
const composer = new Composer<WorkerBotContext>();

// Training command
composer.command('training', async ctx => {
  try {
    log.bot.command('training', ctx.from.id.toString());
    const profile = await db.getWorkerProfile(ctx.from.id.toString());

    if (!profile) {
      return ctx.reply('Please use /start to create your profile first.');
    }

    await ctx.reply(
      '📚 Welcome to Training!\n\n' +
        'This training will help you understand how to:\n' +
        '• Verify different types of content\n' +
        '• Use our quality guidelines\n' +
        '• Earn rewards efficiently\n\n' +
        'Choose a training module:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Text Verification', callback_data: 'train_text' }],
            [{ text: '🖼 Image Verification', callback_data: 'train_image' }],
            [{ text: '🎵 Audio Verification', callback_data: 'train_audio' }],
            [{ text: '🎬 Video Verification', callback_data: 'train_video' }],
            [{ text: '📋 Guidelines & Tips', callback_data: 'train_guidelines' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.reply('Sorry, I encountered an error. Please try again.');
  }
});

// Training module selection
composer.action(/^train_(.+)$/, async ctx => {
  try {
    const module = ctx.match[1];
    ctx.session.trainingModule = module;
    ctx.session.trainingStep = 1;

    const moduleInfo = {
      text: {
        title: '📝 Text Verification Training',
        steps: 5,
        description: 'Learn how to verify text content for accuracy and quality.',
      },
      image: {
        title: '🖼 Image Verification Training',
        steps: 4,
        description: 'Learn how to verify images for authenticity and quality.',
      },
      audio: {
        title: '🎵 Audio Verification Training',
        steps: 4,
        description: 'Learn how to verify audio content for clarity and quality.',
      },
      video: {
        title: '🎬 Video Verification Training',
        steps: 5,
        description: 'Learn how to verify video content for quality and accuracy.',
      },
      guidelines: {
        title: '📋 Guidelines & Tips',
        steps: 3,
        description: 'Learn about our quality standards and best practices.',
      },
    };

    const info = moduleInfo[module as keyof typeof moduleInfo];

    await ctx.editMessageText(
      `${info.title}\n\n` +
        `${info.description}\n\n` +
        `This module has ${info.steps} steps. Ready to begin?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Start Training', callback_data: 'start_training' }],
            [{ text: '⬅️ Back to Modules', callback_data: 'back_to_training' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error selecting training module');
  }
});

// Start training
composer.action('start_training', async ctx => {
  try {
    const module = ctx.session.trainingModule;
    const step = ctx.session.trainingStep;

    const trainingContent = {
      text: [
        {
          title: 'Understanding Text Quality',
          content:
            'Good text content should be:\n• Clear and coherent\n• Free of grammatical errors\n• Factually accurate\n• Well-structured',
          task: 'Review this sample text and identify issues.',
          options: ['Clear and accurate', 'Needs minor fixes', 'Major issues'],
        },
        // Add more steps...
      ],
      image: [
        {
          title: 'Image Quality Basics',
          content:
            'Check images for:\n• Resolution and clarity\n• Relevance to prompt\n• Appropriate content\n• Technical issues',
          task: 'Evaluate this sample image.',
          options: ['Acceptable', 'Needs improvement', 'Reject'],
        },
        // Add more steps...
      ],
      // Add other modules...
    };

    const content = trainingContent[module as keyof typeof trainingContent][step - 1];

    await ctx.editMessageText(
      `Training: ${content.title}\n\n` + `${content.content}\n\n` + `Task: ${content.task}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...content.options.map(opt => [
              { text: opt, callback_data: `training_answer_${opt.toLowerCase()}` },
            ]),
            [{ text: '❌ Exit Training', callback_data: 'exit_training' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error starting training');
  }
});

// Handle training answers
composer.action(/^training_answer_(.+)$/, async ctx => {
  try {
    const answer = ctx.match[1];
    const module = ctx.session.trainingModule;
    const step = ctx.session.trainingStep;

    // Process answer and provide feedback
    await ctx.answerCbQuery('Answer recorded!');

    // Move to next step or complete training
    if (isTrainingComplete(module, step)) {
      await completeTraining(ctx, module);
    } else {
      ctx.session.trainingStep++;
      await ctx.editMessageText('✅ Correct!\n\n' + 'Ready for the next step?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Continue', callback_data: 'start_training' }],
            [{ text: '❌ Exit', callback_data: 'exit_training' }],
          ],
        },
      });
    }
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error processing answer');
  }
});

// Helper functions
function isTrainingComplete(module: string, step: number): boolean {
  const totalSteps = {
    text: 5,
    image: 4,
    audio: 4,
    video: 5,
    guidelines: 3,
  };

  return step >= totalSteps[module as keyof typeof totalSteps];
}

async function completeTraining(ctx: WorkerBotContext, module: string) {
  try {
    const profile = await db.getWorkerProfile(ctx.from.id.toString());
    const completedTraining = profile.completedTraining || [];

    if (!completedTraining.includes(module)) {
      completedTraining.push(module);
      await db.updateWorkerProfile(profile.userId, { completedTraining });
    }

    await ctx.editMessageText(
      '🎉 Congratulations!\n\n' +
        `You've completed the ${module} training module.\n` +
        'You can now start verifying this type of content.\n\n' +
        'What would you like to do next?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 More Training', callback_data: 'back_to_training' }],
            [{ text: '🔍 Start Working', callback_data: 'view_tasks' }],
          ],
        },
      }
    );
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error completing training');
  }
}

// Navigation
composer.action('back_to_training', async ctx => {
  try {
    ctx.session.trainingModule = null;
    ctx.session.trainingStep = null;

    await ctx.editMessageText('📚 Training Modules\n\n' + 'Choose a module to start:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Text Verification', callback_data: 'train_text' }],
          [{ text: '🖼 Image Verification', callback_data: 'train_image' }],
          [{ text: '🎵 Audio Verification', callback_data: 'train_audio' }],
          [{ text: '🎬 Video Verification', callback_data: 'train_video' }],
          [{ text: '📋 Guidelines & Tips', callback_data: 'train_guidelines' }],
        ],
      },
    });
  } catch (error) {
    log.bot.error(error, ctx.from.id.toString());
    await ctx.answerCbQuery('Error returning to training menu');
  }
});

export default composer;
