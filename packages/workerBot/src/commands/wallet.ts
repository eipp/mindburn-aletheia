import { DynamoDB } from 'aws-sdk';
import { Middleware } from 'telegraf';
import { createLogger } from '@mindburn/shared';
import { BotContext, WalletInfo, WorkerProfile } from '../types';

const logger = createLogger('worker-bot:wallet-command');

export const walletCommand = (
  dynamodb: DynamoDB.DocumentClient
): Middleware<BotContext> => {
  return async (ctx: BotContext) => {
    try {
      const userId = ctx.from?.id.toString();
      
      if (!userId) {
        await ctx.reply('Error: Could not identify user.');
        return;
      }

      // Get worker profile and wallet info
      const [profileResult, walletResult] = await Promise.all([
        dynamodb.get({
          TableName: process.env.WORKERS_TABLE!,
          Key: { userId }
        }).promise(),
        dynamodb.get({
          TableName: process.env.WALLETS_TABLE!,
          Key: { userId }
        }).promise()
      ]);

      if (!profileResult.Item) {
        await ctx.reply(
          'Profile not found. Please use /start to create one.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const profile = profileResult.Item as WorkerProfile;
      const wallet = walletResult.Item as WalletInfo;

      if (!wallet || !wallet.address) {
        // No wallet connected
        await ctx.reply(
          ctx.i18n.t('wallet.not_connected'),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
                [{ text: '❓ How to Connect', callback_data: 'wallet_help' }]
              ]
            }
          }
        );
        return;
      }

      // Format wallet address for display
      const displayAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

      // Build wallet status message
      let message = ctx.i18n.t('wallet.status', {
        address: displayAddress,
        balance: wallet.balance.toFixed(2),
        pending: wallet.pendingBalance.toFixed(2)
      }) + '\n\n';

      // Add last withdrawal info if exists
      if (wallet.lastWithdrawal) {
        message += ctx.i18n.t('wallet.last_withdrawal', {
          amount: wallet.lastWithdrawal.amount.toFixed(2),
          date: new Date(wallet.lastWithdrawal.timestamp).toLocaleDateString(),
          status: wallet.lastWithdrawal.status
        }) + '\n\n';
      }

      // Add minimum withdrawal notice
      const MIN_WITHDRAWAL = 1.0; // 1 TON
      const canWithdraw = wallet.balance >= MIN_WITHDRAWAL;

      message += ctx.i18n.t('wallet.min_withdrawal', {
        min: MIN_WITHDRAWAL.toFixed(2)
      });

      const keyboard = [
        [{ 
          text: '💸 Withdraw',
          callback_data: 'withdraw_funds',
          // Disable button if balance is below minimum
          hide: !canWithdraw
        }],
        [
          { text: '📊 Transaction History', callback_data: 'transaction_history' },
          { text: '⚙️ Settings', callback_data: 'wallet_settings' }
        ]
      ].filter(row => row.every(button => !button.hide));

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      logger.info('Wallet status viewed', { userId });
    } catch (error) {
      logger.error('Wallet command error:', error);
      await ctx.reply(
        'Sorry, there was an error retrieving your wallet information. Please try again.',
        { parse_mode: 'HTML' }
      );
    }
  };
}; 