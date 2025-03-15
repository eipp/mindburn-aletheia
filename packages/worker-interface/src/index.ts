import { Telegraf } from 'telegraf';
import { Task, TaskStatus } from '@mindburn/shared';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', (ctx) => {
  ctx.reply('Welcome to Mindburn Aletheia!');
});

bot.launch().catch(console.error);