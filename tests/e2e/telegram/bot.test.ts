import { Telegraf } from 'telegraf';
import { TelegramBot } from '@/telegram/bot';
import { sleep } from '@/utils/testing';

describe('Telegram Bot E2E', () => {
  let bot: TelegramBot;
  let testUser: { id: number; username: string };

  beforeAll(async () => {
    const token = process.env.TEST_BOT_TOKEN;
    if (!token) throw new Error('TEST_BOT_TOKEN not set');

    bot = new TelegramBot(token);
    await bot.start();

    // Use a test user account for E2E tests
    testUser = {
      id: parseInt(process.env.TEST_USER_ID || '0'),
      username: process.env.TEST_USERNAME || 'test_user',
    };
  });

  afterAll(async () => {
    await bot.stop();
  });

  it('should handle start command', async () => {
    const response = await bot.handleCommand('/start', testUser);
    expect(response).toMatch(/Welcome to Mindburn Aletheia/);
  });

  it('should complete verification task workflow', async () => {
    // Request a task
    const taskResponse = await bot.handleCommand('/task', testUser);
    expect(taskResponse).toMatch(/New verification task/);

    // Extract task ID from response
    const taskId = taskResponse.match(/Task ID: ([A-Za-z0-9-]+)/)?.[1];
    expect(taskId).toBeDefined();

    // Submit verification
    const verifyResponse = await bot.handleMessage(`/verify ${taskId} APPROVED`, testUser);
    expect(verifyResponse).toMatch(/Verification submitted/);

    // Wait for processing
    await sleep(2000);

    // Check status
    const statusResponse = await bot.handleCommand(`/status ${taskId}`, testUser);
    expect(statusResponse).toMatch(/Status: COMPLETED/);
  }, 30000);

  it('should handle wallet connection', async () => {
    const connectResponse = await bot.handleCommand('/connect_wallet', testUser);
    expect(connectResponse).toMatch(/Please connect your TON wallet/);

    // Simulate wallet connection callback
    const callbackResponse = await bot.handleCallback('wallet_connected', {
      ...testUser,
      wallet: '0x1234567890',
    });

    expect(callbackResponse).toMatch(/Wallet connected successfully/);
  });

  it('should process rewards', async () => {
    // Complete a verification task
    const taskResponse = await bot.handleCommand('/task', testUser);
    const taskId = taskResponse.match(/Task ID: ([A-Za-z0-9-]+)/)?.[1];
    await bot.handleMessage(`/verify ${taskId} APPROVED`, testUser);

    // Wait for processing
    await sleep(2000);

    // Check rewards
    const rewardsResponse = await bot.handleCommand('/rewards', testUser);
    expect(rewardsResponse).toMatch(/Pending rewards:/);
    expect(rewardsResponse).toMatch(/\d+\.\d+ TON/);
  }, 30000);
});
