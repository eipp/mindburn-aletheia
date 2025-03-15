import { Composer } from 'telegraf';
import { BotContext, UserState, TaskStatus } from '../types';
import { docClient, TableNames, QueueUrls } from '../services/aws';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../services/aws';
import logger from '../utils/logger';

const composer = new Composer<BotContext>();

// Start command - initiates registration
composer.command('start', async (ctx: BotContext) => {
  if (ctx.session.state !== UserState.INITIAL) {
    await ctx.reply('Welcome back! Use /help to see available commands.');
    return;
  }

  await ctx.reply(
    'Welcome to Aletheia! 🎉\n\n' +
    'We help verify AI outputs through human verification.\n\n' +
    'To get started, you need to:\n' +
    '1. Complete registration (/register)\n' +
    '2. Connect your TON wallet (/wallet)\n' +
    '3. Start working on tasks (/tasks)'
  );
});

// Register command
composer.command('register', async (ctx: BotContext) => {
  if (ctx.session.state !== UserState.INITIAL) {
    await ctx.reply('You are already registered! Use /tasks to start working.');
    return;
  }

  ctx.session.state = UserState.REGISTERING;
  
  await ctx.reply(
    'Please provide your information:\n\n' +
    '1. What is your preferred language for tasks? (e.g., "en" for English)\n' +
    '2. Do you have experience in content moderation? (Yes/No)\n\n' +
    'Reply with your answers in the format: "language, experience"\n' +
    'Example: "en, Yes"'
  );
});

// Wallet command - handles TON wallet connection
composer.command('wallet', async (ctx: BotContext) => {
  if (ctx.session.state === UserState.INITIAL) {
    await ctx.reply('Please register first using /register');
    return;
  }

  ctx.session.state = UserState.CONNECTING_WALLET;
  
  await ctx.reply(
    'To receive payments, you need to connect your TON wallet.\n\n' +
    'Please send your TON wallet address.'
  );
});

// Tasks command - shows available tasks
composer.command('tasks', async (ctx: BotContext) => {
  if (!ctx.session.walletAddress) {
    await ctx.reply('Please connect your TON wallet first using /wallet');
    return;
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TableNames.TASKS,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.PENDING,
      },
      Limit: 5,
    }));

    if (!result.Items?.length) {
      await ctx.reply('No tasks available at the moment. Please check back later!');
      return;
    }

    const taskMessages = result.Items.map((task: any) => 
      `Task ID: ${task.id}\n` +
      `Type: ${task.type}\n` +
      `Reward: ${task.reward} TON\n` +
      `Time limit: ${Math.round((task.deadline - Date.now()) / 60000)} minutes\n\n` +
      `Use /accept ${task.id} to take this task`
    );

    await ctx.reply(
      'Available Tasks:\n\n' +
      taskMessages.join('\n---\n')
    );
  } catch (error) {
    logger.error('Error fetching tasks', { error });
    await ctx.reply('Error fetching tasks. Please try again later.');
  }
});

// Accept task command
composer.command('accept', async (ctx: BotContext) => {
  if (!ctx.message || !('text' in ctx.message)) {
    await ctx.reply('Invalid command format.');
    return;
  }

  const taskId = ctx.message.text.split(' ')[1];
  if (!taskId) {
    await ctx.reply('Please provide a task ID: /accept <task_id>');
    return;
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TableNames.TASKS,
      Key: { id: taskId },
    }));

    if (!result.Item) {
      await ctx.reply('Task not found.');
      return;
    }

    if (result.Item.status !== TaskStatus.PENDING) {
      await ctx.reply('This task is no longer available.');
      return;
    }

    await docClient.send(new UpdateCommand({
      TableName: TableNames.TASKS,
      Key: { id: taskId },
      UpdateExpression: 'SET #status = :status, assignedTo = :userId',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.ASSIGNED,
        ':userId': ctx.session.userId,
        ':pendingStatus': TaskStatus.PENDING,
      },
      ConditionExpression: '#status = :pendingStatus',
    }));

    ctx.session.currentTask = taskId;
    ctx.session.state = UserState.WORKING;

    await ctx.reply(
      'Task accepted! Here are the details:\n\n' +
      `Type: ${result.Item.type}\n` +
      `Instructions: ${result.Item.data.instructions}\n\n` +
      'When ready, submit your verification using /submit <your_answer>'
    );
  } catch (error) {
    logger.error('Error accepting task', { error, taskId });
    await ctx.reply('Error accepting task. Please try again.');
  }
});

// Submit task command
composer.command('submit', async (ctx: BotContext) => {
  if (!ctx.message || !('text' in ctx.message)) {
    await ctx.reply('Invalid command format.');
    return;
  }

  if (!ctx.session.currentTask) {
    await ctx.reply('No active task. Use /tasks to find a task.');
    return;
  }

  const answer = ctx.message.text.split(' ').slice(1).join(' ');
  if (!answer) {
    await ctx.reply('Please provide your answer: /submit <your_answer>');
    return;
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TableNames.TASKS,
      Key: { id: ctx.session.currentTask },
      UpdateExpression: 'SET #status = :status, submittedAt = :now, result = :result',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': TaskStatus.SUBMITTED,
        ':now': Date.now(),
        ':result': { answer },
      },
    }));

    // Notify task queue about submission
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: QueueUrls.TASKS,
      MessageBody: JSON.stringify({
        type: 'TASK_SUBMITTED',
        taskId: ctx.session.currentTask,
        userId: ctx.session.userId,
      }),
    }));

    ctx.session.state = UserState.IDLE;
    ctx.session.currentTask = undefined;

    await ctx.reply(
      'Task submitted successfully! 🎉\n\n' +
      'We will review your submission and process the payment soon.\n' +
      'Use /tasks to find more tasks.'
    );
  } catch (error) {
    logger.error('Error submitting task', { error, taskId: ctx.session.currentTask });
    await ctx.reply('Error submitting task. Please try again.');
  }
});

// Stats command
composer.command('stats', async (ctx: BotContext) => {
  await ctx.reply(
    'Your Statistics:\n\n' +
    `Total Tasks: ${ctx.session.totalTasks}\n` +
    `Completed Tasks: ${ctx.session.completedTasks}\n` +
    `Success Rate: ${ctx.session.totalTasks ? Math.round((ctx.session.completedTasks / ctx.session.totalTasks) * 100) : 0}%\n` +
    `Reputation Score: ${ctx.session.reputation}\n` +
    `Total Earnings: ${ctx.session.earnings} TON`
  );
});

// Help command
composer.command('help', async (ctx: BotContext) => {
  await ctx.reply(
    'Available Commands:\n\n' +
    '/start - Start the bot\n' +
    '/register - Complete registration\n' +
    '/wallet - Connect TON wallet\n' +
    '/tasks - View available tasks\n' +
    '/accept <task_id> - Accept a task\n' +
    '/submit <answer> - Submit task result\n' +
    '/stats - View your statistics\n' +
    '/help - Show this help message'
  );
});

export default composer; 