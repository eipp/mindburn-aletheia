import { Composer } from 'telegraf';
import { WorkerBotContext, Task, TaskStatus, TaskType } from '../types';
import { logger } from '../utils/logger';
import { DynamoDBService } from '../services/dynamodb';
import { TonService } from '../services/ton';
import { VerificationService, VerificationResult } from '@mindburn/shared';
import { Scenes } from 'telegraf';
import { DynamoDB, SQS } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { BotContext, TaskDetails, TaskSubmission } from '../types';

const db = new DynamoDBService();
const ton = new TonService();
const verificationService = new VerificationService({
  minTonBalance: 0.1,
  checkIPRestrictions: true,
  checkAccountAge: true,
  minAccountAgeDays: 3,
  maxVerificationsPerDay: 10,
  maxVerificationsPerIP: 5
});
const composer = new Composer<WorkerBotContext>();

const logger = createLogger('worker-bot:verification-flow');

export const verificationScene = new Scenes.WizardScene<BotContext>(
  'verification',
  // Step 1: Show Task Details
  async (ctx) => {
    try {
      const taskId = ctx.scene.state.taskId;
      if (!taskId) {
        throw new Error('No task ID provided');
      }

      const dynamodb = new DynamoDB.DocumentClient();
      const taskResult = await dynamodb.get({
        TableName: process.env.TASKS_TABLE!,
        Key: { id: taskId }
      }).promise();

      if (!taskResult.Item) {
        await ctx.reply(
          'Task not found or no longer available.',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 View Other Tasks', callback_data: 'view_tasks' }]
              ]
            }
          }
        );
        return ctx.scene.leave();
      }

      const task = taskResult.Item as TaskDetails;
      ctx.scene.state.task = task;

      // Show task details and instructions
      await ctx.reply(
        ctx.i18n.t('verification.task_details', {
          type: task.type,
          reward: task.reward.toFixed(2),
          complexity: '⭐'.repeat(task.complexity),
          timeLeft: formatTimeLeft(task.deadline),
          description: task.description
        }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Start Verification', callback_data: 'start_verification' }],
              [{ text: '❌ Cancel', callback_data: 'cancel' }]
            ]
          }
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error('Task details error:', error);
      await ctx.reply('Error loading task details. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Task Verification
  async (ctx) => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data === 'cancel') {
        await ctx.reply('Task verification cancelled.');
        return ctx.scene.leave();
      }

      if (ctx.callbackQuery.data === 'start_verification') {
        const task = ctx.scene.state.task as TaskDetails;
        
        // Start verification timer
        ctx.scene.state.startTime = Date.now();

        // Show verification interface based on task type
        let message = ctx.i18n.t('verification.instructions', {
          type: task.type
        });

        let keyboard;
        if (task.type === 'text') {
          keyboard = [
            [
              { text: '👍 Approve', callback_data: 'verify_approve' },
              { text: '👎 Reject', callback_data: 'verify_reject' }
            ],
            [{ text: '🚫 Flag as Inappropriate', callback_data: 'verify_flag' }]
          ];
        } else if (task.type === 'image') {
          keyboard = [
            [
              { text: '✅ Safe', callback_data: 'verify_safe' },
              { text: '⚠️ NSFW', callback_data: 'verify_nsfw' },
              { text: '🚫 Unsafe', callback_data: 'verify_unsafe' }
            ]
          ];
        }

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              ...keyboard,
              [{ text: '❌ Cancel', callback_data: 'cancel' }]
            ]
          }
        });

        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Verification start error:', error);
      await ctx.reply('Error starting verification. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Submit Verification
  async (ctx) => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data === 'cancel') {
        await ctx.reply('Task verification cancelled.');
        return ctx.scene.leave();
      }

      const task = ctx.scene.state.task as TaskDetails;
      const startTime = ctx.scene.state.startTime as number;
      const timeSpent = (Date.now() - startTime) / 1000; // Convert to seconds

      // Process verification result
      const answer = ctx.callbackQuery.data.replace('verify_', '');
      const submission: TaskSubmission = {
        taskId: task.id,
        workerId: ctx.from!.id.toString(),
        answer,
        confidence: calculateConfidence(timeSpent, task.complexity),
        timeSpent,
        submittedAt: new Date().toISOString()
      };

      // Save submission
      const dynamodb = new DynamoDB.DocumentClient();
      await dynamodb.put({
        TableName: process.env.SUBMISSIONS_TABLE!,
        Item: submission
      }).promise();

      // Send to verification queue
      const sqs = new SQS();
      await sqs.sendMessage({
        QueueUrl: process.env.VERIFICATION_QUEUE_URL!,
        MessageBody: JSON.stringify(submission)
      }).promise();

      // Update task status if needed
      await dynamodb.update({
        TableName: process.env.TASKS_TABLE!,
        Key: { id: task.id },
        UpdateExpression: 'SET submissionsCount = submissionsCount + :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        }
      }).promise();

      await ctx.reply(
        ctx.i18n.t('verification.submitted', {
          reward: task.reward.toFixed(2)
        }),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 More Tasks', callback_data: 'view_tasks' }],
              [{ text: '💰 View Earnings', callback_data: 'view_wallet' }]
            ]
          }
        }
      );

      logger.info('Verification submitted', {
        userId: ctx.from!.id,
        taskId: task.id,
        timeSpent,
        answer
      });

      return ctx.scene.leave();
    } catch (error) {
      logger.error('Submission error:', error);
      await ctx.reply('Error submitting verification. Please try again.');
      return ctx.scene.leave();
    }
  }
);

function formatTimeLeft(deadline: string): string {
  const timeLeft = new Date(deadline).getTime() - Date.now();
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function calculateConfidence(timeSpent: number, complexity: number): number {
  // Base confidence calculation
  const minTime = complexity * 5; // Minimum expected time in seconds
  const maxTime = complexity * 30; // Maximum expected time in seconds
  
  if (timeSpent < minTime) {
    // Too fast - lower confidence
    return Math.max(0.5, timeSpent / minTime);
  } else if (timeSpent > maxTime) {
    // Too slow - slightly lower confidence
    return Math.max(0.7, 1 - ((timeSpent - maxTime) / maxTime));
  } else {
    // Optimal time range - high confidence
    return 1.0;
  }
}

// Start verification process
composer.action('start_verification', async (ctx) => {
  try {
    const taskId = ctx.session.currentTaskId;
    if (!taskId) {
      return ctx.answerCbQuery('No active task found');
    }
    
    const task = await db.getTask(taskId);
    if (!task) {
      return ctx.answerCbQuery('Task not found');
    }
    
    // Initialize verification session
    ctx.session.verificationData = {};
    
    // First check for fraud and eligibility
    if (await performFraudAndEligibilityCheck(ctx)) {
      // Start type-specific verification flow
      switch (task.type) {
        case TaskType.TEXT_VERIFICATION:
          await startTextVerification(ctx, task);
          break;
        case TaskType.IMAGE_VERIFICATION:
          await startImageVerification(ctx, task);
          break;
        case TaskType.AUDIO_VERIFICATION:
          await startAudioVerification(ctx, task);
          break;
        case TaskType.VIDEO_VERIFICATION:
          await startVideoVerification(ctx, task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
    }
  } catch (error) {
    logger.error('Error starting verification:', error);
    await ctx.answerCbQuery('Error starting verification');
  }
});

/**
 * Perform fraud and eligibility checks using the shared verification service
 */
async function performFraudAndEligibilityCheck(ctx: WorkerBotContext): Promise<boolean> {
  try {
    if (!ctx.from || !ctx.session.walletAddress) {
      await ctx.reply('⚠️ You need to register your wallet before verifying tasks.');
      return false;
    }

    const userAgent = ctx.telegram.options.agent?.toString() || '';
    const ipAddress = ctx.from.id.toString(); // Using Telegram ID as a proxy since we can't get real IP

    // Get user profile for metadata
    const user = await ctx.telegram.getChat(ctx.from.id);
    
    // Run the shared verification service
    const verificationResult: VerificationResult = await verificationService.verify({
      userId: ctx.from.id.toString(),
      walletAddress: ctx.session.walletAddress,
      ipAddress: ipAddress,
      userAgentString: userAgent,
      timestamp: Date.now()
    });

    if (!verificationResult.success) {
      logger.warn('User verification failed', {
        userId: ctx.from.id,
        walletAddress: ctx.session.walletAddress,
        errors: verificationResult.errors,
        fraudScore: verificationResult.fraudScore
      });

      await ctx.reply(
        '⚠️ Verification failed:\n\n' + 
        verificationResult.errors.map(e => `• ${e}`).join('\n') + 
        '\n\nPlease address these issues and try again.'
      );
      return false;
    }

    // Show warnings if any
    if (verificationResult.warnings.length > 0) {
      await ctx.reply(
        '⚠️ Verification warnings:\n\n' + 
        verificationResult.warnings.map(w => `• ${w}`).join('\n') + 
        '\n\nYou can proceed, but please note these concerns.'
      );
    }

    return true;
  } catch (error) {
    logger.error('Error during fraud and eligibility check:', error);
    await ctx.reply('⚠️ An error occurred during verification checks. Please try again later.');
    return false;
  }
}

// Text verification flow
async function startTextVerification(ctx: WorkerBotContext, task: Task) {
  const steps = [
    {
      question: 'Is the text coherent and well-structured?',
      options: ['Yes', 'Partially', 'No']
    },
    {
      question: 'Does the text contain factual errors?',
      options: ['No errors found', 'Minor errors', 'Major errors']
    },
    {
      question: 'Rate the overall quality (1-5)',
      options: ['1', '2', '3', '4', '5']
    }
  ];
  
  ctx.session.verificationSteps = steps;
  ctx.session.currentStep = 0;
  
  await ctx.editMessageText(
    `📝 Text Verification - Step 1/${steps.length}\n\n` +
    `${steps[0].question}`,
    {
      reply_markup: {
        inline_keyboard: steps[0].options.map(opt => ([
          { text: opt, callback_data: `verify_text_${opt.toLowerCase()}` }
        ]))
      }
    }
  );
}

// Image verification flow
async function startImageVerification(ctx: WorkerBotContext, task: Task) {
  const steps = [
    {
      question: 'Is the image clear and properly rendered?',
      options: ['Yes', 'Partially', 'No']
    },
    {
      question: 'Does the image match the description/prompt?',
      options: ['Perfect match', 'Partial match', 'No match']
    },
    {
      question: 'Are there any visual artifacts or errors?',
      options: ['None', 'Minor', 'Major']
    }
  ];
  
  ctx.session.verificationSteps = steps;
  ctx.session.currentStep = 0;
  
  await ctx.editMessageText(
    `🖼 Image Verification - Step 1/${steps.length}\n\n` +
    `${steps[0].question}`,
    {
      reply_markup: {
        inline_keyboard: steps[0].options.map(opt => ([
          { text: opt, callback_data: `verify_image_${opt.toLowerCase()}` }
        ]))
      }
    }
  );
}

// Audio verification flow
async function startAudioVerification(ctx: WorkerBotContext, task: Task) {
  const steps = [
    {
      question: 'Is the audio clear and audible?',
      options: ['Yes', 'Partially', 'No']
    },
    {
      question: 'Does the audio match the description/prompt?',
      options: ['Perfect match', 'Partial match', 'No match']
    },
    {
      question: 'Are there any audio artifacts or noise?',
      options: ['None', 'Minor', 'Major']
    }
  ];
  
  ctx.session.verificationSteps = steps;
  ctx.session.currentStep = 0;
  
  await ctx.editMessageText(
    `🎵 Audio Verification - Step 1/${steps.length}\n\n` +
    `${steps[0].question}`,
    {
      reply_markup: {
        inline_keyboard: steps[0].options.map(opt => ([
          { text: opt, callback_data: `verify_audio_${opt.toLowerCase()}` }
        ]))
      }
    }
  );
}

// Video verification flow
async function startVideoVerification(ctx: WorkerBotContext, task: Task) {
  const steps = [
    {
      question: 'Is the video clear and properly rendered?',
      options: ['Yes', 'Partially', 'No']
    },
    {
      question: 'Does the video match the description/prompt?',
      options: ['Perfect match', 'Partial match', 'No match']
    },
    {
      question: 'Are there any visual/audio artifacts?',
      options: ['None', 'Minor', 'Major']
    },
    {
      question: 'Is the video length appropriate?',
      options: ['Yes', 'Too short', 'Too long']
    }
  ];
  
  ctx.session.verificationSteps = steps;
  ctx.session.currentStep = 0;
  
  await ctx.editMessageText(
    `🎬 Video Verification - Step 1/${steps.length}\n\n` +
    `${steps[0].question}`,
    {
      reply_markup: {
        inline_keyboard: steps[0].options.map(opt => ([
          { text: opt, callback_data: `verify_video_${opt.toLowerCase()}` }
        ]))
      }
    }
  );
}

// Handle verification responses
composer.action(/^verify_(text|image|audio|video)_(.+)$/, async (ctx) => {
  try {
    const [type, response] = [ctx.match[1], ctx.match[2]];
    const steps = ctx.session.verificationSteps;
    let currentStep = ctx.session.currentStep;
    
    // Save response
    ctx.session.verificationData[`step${currentStep + 1}`] = response;
    currentStep++;
    
    if (currentStep < steps.length) {
      // Show next question
      ctx.session.currentStep = currentStep;
      await ctx.editMessageText(
        `${type === 'text' ? '📝' : type === 'image' ? '🖼' : type === 'audio' ? '🎵' : '🎬'} ${type.charAt(0).toUpperCase() + type.slice(1)} Verification - Step ${currentStep + 1}/${steps.length}\n\n` +
        `${steps[currentStep].question}`,
        {
          reply_markup: {
            inline_keyboard: steps[currentStep].options.map(opt => ([
              { text: opt, callback_data: `verify_${type}_${opt.toLowerCase()}` }
            ]))
          }
        }
      );
    } else {
      // Verification complete, show summary
      await showVerificationSummary(ctx, type);
    }
  } catch (error) {
    logger.error('Error processing verification:', error);
    await ctx.answerCbQuery('Error processing verification');
  }
});

// Show verification summary
async function showVerificationSummary(ctx: WorkerBotContext, type: string) {
  try {
    const taskId = ctx.session.currentTaskId;
    const task = await db.getTask(taskId);
    const data = ctx.session.verificationData;
    
    let summary = `✅ Verification Complete!\n\n`;
    summary += `Task Type: ${type.toUpperCase()}\n`;
    summary += `Your Responses:\n`;
    
    for (const [step, response] of Object.entries(data)) {
      summary += `• ${step}: ${response}\n`;
    }
    
    await ctx.editMessageText(
      summary + '\n\nPlease review your responses and submit or retry.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Submit', callback_data: 'submit_verification' }],
            [{ text: '🔄 Start Over', callback_data: 'start_verification' }],
            [{ text: '❌ Cancel', callback_data: 'cancel_task' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error showing verification summary:', error);
  }
}

// Submit verification results
composer.action('submit_verification', async (ctx) => {
  try {
    const taskId = ctx.session.currentTaskId;
    const userId = ctx.from.id.toString();
    
    if (!taskId) {
      return ctx.answerCbQuery('No active task found');
    }
    
    const task = await db.getTask(taskId);
    if (!task) {
      return ctx.answerCbQuery('Task not found');
    }
    
    // Update task status
    const updatedTask = {
      ...task,
      status: TaskStatus.VERIFIED,
      verifiedBy: userId,
      verificationData: ctx.session.verificationData,
      updatedAt: Date.now()
    };
    
    await db.updateTask(updatedTask);
    
    // Process reward
    const reward = await processReward(ctx, task);
    
    await ctx.editMessageText(
      `✅ Verification submitted successfully!\n\n` +
      `Task ID: ${taskId}\n` +
      `Reward: ${reward.amount} TON\n` +
      `Status: ${reward.status}\n` +
      (reward.txId ? `Transaction: ${ton.getExplorerUrl(reward.txId)}` : ''),
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 View Available Tasks', callback_data: 'view_tasks' }]
          ]
        }
      }
    );
    
    // Clear session data
    ctx.session.currentTaskId = null;
    ctx.session.verificationData = {};
    ctx.session.verificationSteps = [];
    ctx.session.currentStep = 0;
    
  } catch (error) {
    logger.error('Error submitting verification:', error);
    await ctx.answerCbQuery('Error submitting verification');
  }
});

// Process reward for completed verification
async function processReward(ctx: WorkerBotContext, task: Task) {
  try {
    if (!ctx.session.walletAddress) {
      await ctx.reply('⚠️ No wallet address found. Please register your wallet first.');
      return { status: 'failed', amount: 0 };
    }
    
    // Calculate reward based on task
    const amount = task.reward || 1; // Default 1 TON if not specified
    
    // Process reward using TonService
    const transaction = await ton.processReward({
      userId: ctx.from.id.toString(),
      taskId: task.id,
      amount,
      toAddress: ctx.session.walletAddress
    });
    
    return {
      status: transaction.status,
      amount,
      txId: transaction.hash
    };
  } catch (error) {
    logger.error('Error processing reward:', error);
    return { status: 'failed', amount: 0 };
  }
}

// Export the composer
export default composer; 