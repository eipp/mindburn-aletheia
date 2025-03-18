import { Scenes } from 'telegraf';
import { DynamoDB } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { BotContext, WalletInfo } from '../types';

const logger = createLogger('worker-bot:wallet-flow');

export const walletScene = new Scenes.WizardScene<BotContext>(
  'wallet',
  // Step 1: Start Wallet Connection
  async ctx => {
    try {
      await ctx.reply(ctx.i18n.t('wallet.connect.start'), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔗 Connect TON Wallet', callback_data: 'connect_ton' }],
            [{ text: '❓ How to Connect', callback_data: 'wallet_help' }],
            [{ text: '❌ Cancel', callback_data: 'cancel' }],
          ],
        },
      });
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Wallet connection start error:', error);
      await ctx.reply('Error starting wallet connection. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Handle Connection Method
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data === 'cancel') {
        await ctx.reply('Wallet connection cancelled.');
        return ctx.scene.leave();
      }

      if (ctx.callbackQuery.data === 'wallet_help') {
        await ctx.reply(ctx.i18n.t('wallet.connect.help'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Connect TON Wallet', callback_data: 'connect_ton' }],
              [{ text: '❌ Cancel', callback_data: 'cancel' }],
            ],
          },
        });
        return;
      }

      if (ctx.callbackQuery.data === 'connect_ton') {
        // Generate verification message
        const verificationCode = generateVerificationCode();
        ctx.session.data = { verificationCode };

        await ctx.reply(
          ctx.i18n.t('wallet.connect.verify', {
            code: verificationCode,
          }),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ I've Sent the Transaction", callback_data: 'verify_transaction' }],
                [{ text: '🔄 Generate New Code', callback_data: 'new_code' }],
                [{ text: '❌ Cancel', callback_data: 'cancel' }],
              ],
            },
          }
        );
        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Wallet connection method error:', error);
      await ctx.reply('Error during wallet connection. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Verify Transaction
  async ctx => {
    try {
      if (!ctx.callbackQuery?.data) {
        return;
      }

      if (ctx.callbackQuery.data === 'cancel') {
        await ctx.reply('Wallet connection cancelled.');
        return ctx.scene.leave();
      }

      if (ctx.callbackQuery.data === 'new_code') {
        const verificationCode = generateVerificationCode();
        ctx.session.data.verificationCode = verificationCode;

        await ctx.reply(
          ctx.i18n.t('wallet.connect.verify', {
            code: verificationCode,
          }),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ I've Sent the Transaction", callback_data: 'verify_transaction' }],
                [{ text: '🔄 Generate New Code', callback_data: 'new_code' }],
                [{ text: '❌ Cancel', callback_data: 'cancel' }],
              ],
            },
          }
        );
        return;
      }

      if (ctx.callbackQuery.data === 'verify_transaction') {
        await ctx.reply(ctx.i18n.t('wallet.connect.checking'), { parse_mode: 'HTML' });

        // TODO: Implement actual blockchain transaction verification
        // For now, simulate verification
        const walletAddress = 'EQDrjaLahLkMB-MCpRWk-DYGkJlrnbYHLgXxV1h7-VKGW0Qz';

        const userId = ctx.from?.id.toString();
        if (!userId) {
          throw new Error('No user ID found');
        }

        // Save wallet info
        const dynamodb = new DynamoDB.DocumentClient();
        const walletInfo: WalletInfo = {
          address: walletAddress,
          balance: 0,
          pendingBalance: 0,
          createdAt: new Date().toISOString(),
        };

        await dynamodb
          .put({
            TableName: process.env.WALLETS_TABLE!,
            Item: {
              userId,
              ...walletInfo,
            },
          })
          .promise();

        await ctx.reply(
          ctx.i18n.t('wallet.connect.success', {
            address: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          }),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 View Wallet', callback_data: 'view_wallet' }],
                [{ text: '📋 Available Tasks', callback_data: 'view_tasks' }],
              ],
            },
          }
        );

        logger.info('Wallet connected', { userId, address: walletAddress });
        return ctx.scene.leave();
      }
    } catch (error) {
      logger.error('Wallet verification error:', error);
      await ctx.reply('Error verifying wallet connection. Please try again.');
      return ctx.scene.leave();
    }
  }
);

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
