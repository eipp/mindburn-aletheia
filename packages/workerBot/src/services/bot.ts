import { Bot, Context, session } from 'grammy';
import {
  WorkerService,
  WorkerProfile,
  WorkerTask,
  TaskSubmission,
  TaskAssignment
} from "@mindburn/workerCore";

interface BotContext extends Context {
  session: {
    workerId?: string;
    currentTask?: string;
    step?: string;
  };
}

export class BotService {
  private bot: Bot<BotContext>;
  private workerService: WorkerService;

  constructor(token: string) {
    this.bot = new Bot<BotContext>(token);
    this.workerService = new WorkerService();

    // Initialize session middleware
    this.bot.use(session({
      initial: () => ({})
    }));

    this.setupHandlers();
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', this.handleStart.bind(this));

    // Profile management
    this.bot.command('profile', this.handleProfile.bind(this));
    this.bot.command('preferences', this.handlePreferences.bind(this));

    // Task management
    this.bot.command('tasks', this.handleTasks.bind(this));
    this.bot.command('accept', this.handleAcceptTask.bind(this));
    this.bot.command('reject', this.handleRejectTask.bind(this));
    this.bot.command('submit', this.handleSubmitTask.bind(this));

    // Error handling
    this.bot.catch(this.handleError.bind(this));
  }

  private async handleStart(ctx: BotContext) {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.reply('Error: Could not identify user');
        return;
      }

      // Create or get worker profile
      const profile = await this.getOrCreateProfile(telegramId);
      ctx.session.workerId = profile.id;

      await ctx.reply(
        `Welcome to Mindburn Aletheia Worker Bot!\n\n` +
        `Your worker ID: ${profile.id}\n` +
        `Tasks completed: ${profile.tasksCompleted}\n` +
        `Reputation: ${profile.reputation}\n\n` +
        `Use /tasks to see available tasks`
      );
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleProfile(ctx: BotContext) {
    try {
      if (!ctx.session.workerId) {
        await ctx.reply('Please start the bot first with /start');
        return;
      }

      const profile = await this.workerService.getProfile(ctx.session.workerId);
      await ctx.reply(
        `Profile Information:\n\n` +
        `Name: ${profile.name}\n` +
        `Status: ${profile.status}\n` +
        `Tasks Completed: ${profile.tasksCompleted}\n` +
        `Success Rate: ${profile.successRate}%\n` +
        `Reputation: ${profile.reputation}\n` +
        `Skills: ${profile.skills.join(', ')}\n` +
        `Languages: ${profile.languages.join(', ')}`
      );
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handlePreferences(ctx: BotContext) {
    try {
      if (!ctx.session.workerId) {
        await ctx.reply('Please start the bot first with /start');
        return;
      }

      const preferences = await this.workerService.getPreferences(ctx.session.workerId);
      await ctx.reply(
        `Your Preferences:\n\n` +
        `Task Types: ${preferences.taskTypes.join(', ')}\n` +
        `Minimum Reward: ${preferences.minReward} TON\n` +
        `Maximum Duration: ${preferences.maxDuration} minutes\n` +
        `Languages: ${preferences.languages.join(', ')}\n` +
        `Auto Accept: ${preferences.autoAccept ? 'Yes' : 'No'}`
      );
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleTasks(ctx: BotContext) {
    try {
      if (!ctx.session.workerId) {
        await ctx.reply('Please start the bot first with /start');
        return;
      }

      const tasks = await this.workerService.getAvailableTasks(ctx.session.workerId);
      if (tasks.length === 0) {
        await ctx.reply('No tasks available at the moment');
        return;
      }

      const taskList = tasks.map((task, index) => 
        `${index + 1}. ${task.title}\n` +
        `   Type: ${task.type}\n` +
        `   Reward: ${task.reward} TON\n` +
        `   Duration: ${task.estimatedDuration} min\n` +
        `   ID: ${task.id}`
      ).join('\n\n');

      await ctx.reply(
        `Available Tasks:\n\n${taskList}\n\n` +
        `Use /accept <task_id> to accept a task`
      );
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleAcceptTask(ctx: BotContext) {
    try {
      if (!ctx.session.workerId) {
        await ctx.reply('Please start the bot first with /start');
        return;
      }

      const taskId = ctx.message?.text.split(' ')[1];
      if (!taskId) {
        await ctx.reply('Please provide a task ID: /accept <task_id>');
        return;
      }

      await this.workerService.acceptTask(ctx.session.workerId, taskId);
      ctx.session.currentTask = taskId;

      await ctx.reply(
        `Task ${taskId} accepted!\n\n` +
        `Use /submit when you're ready to submit your work`
      );
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleRejectTask(ctx: BotContext) {
    try {
      if (!ctx.session.workerId) {
        await ctx.reply('Please start the bot first with /start');
        return;
      }

      const [_, taskId, ...reasonParts] = ctx.message?.text.split(' ') || [];
      if (!taskId) {
        await ctx.reply('Please provide a task ID and reason: /reject <task_id> <reason>');
        return;
      }

      const reason = reasonParts.join(' ') || 'No reason provided';
      await this.workerService.rejectTask(ctx.session.workerId, taskId, reason);

      await ctx.reply(`Task ${taskId} rejected`);
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleSubmitTask(ctx: BotContext) {
    try {
      if (!ctx.session.workerId || !ctx.session.currentTask) {
        await ctx.reply('No active task. Accept a task first with /accept <task_id>');
        return;
      }

      // This is a simplified submission flow
      // In a real bot, you'd want to handle file uploads and structured responses
      const submission: TaskSubmission = {
        taskId: ctx.session.currentTask,
        workerId: ctx.session.workerId,
        timestamp: new Date(),
        responses: {
          text: ctx.message?.text.split('/submit ')[1] || ''
        },
        evidence: [],
        duration: 0,
        confidence: 1
      };

      await this.workerService.submitTask(submission);
      ctx.session.currentTask = undefined;

      await ctx.reply('Task submitted successfully!');
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  private async handleError(error: unknown, ctx: BotContext) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    await ctx.reply(`Error: ${message}\n\nPlease try again or contact support if the issue persists.`);
  }

  private async getOrCreateProfile(telegramId: number): Promise<WorkerProfile> {
    // Implementation would depend on your user management system
    // This is a placeholder that assumes the profile exists
    return this.workerService.getProfile(telegramId.toString());
  }

  public start() {
    this.bot.start();
  }
} 