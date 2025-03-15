import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { walletService, Transaction, WalletBalance } from '../services/wallet';

interface WalletState {
  address: string | null;
  balance: WalletBalance | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  secretKey: Uint8Array | null;
  pendingWithdrawal: boolean;

  // Actions
  setAddress: (address: string) => void;
  setSecretKey: (key: Uint8Array) => void;
  fetchBalance: (address: string) => Promise<void>;
  fetchTransactions: (address: string, limit?: number) => Promise<void>;
  withdraw: (params: {
    toAddress: string;
    amount: number;
  }) => Promise<{ hash: string }>;
  createWallet: (mnemonic: string[]) => Promise<void>;
  reset: () => void;
}

export const useWalletStore = create<WalletState>()(
  devtools(
    persist(
      (set, get) => ({
        address: null,
        balance: null,
        transactions: [],
        isLoading: false,
        error: null,
        secretKey: null,
        pendingWithdrawal: false,

        setAddress: (address) => set({ address }),

        setSecretKey: (key) => set({ secretKey: key }),

        fetchBalance: async (address) => {
          try {
            set({ isLoading: true, error: null });
            const balance = await walletService.getBalance(address);
            set({ balance, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to fetch balance',
              isLoading: false
            });
          }
        },

        fetchTransactions: async (address, limit = 10) => {
          try {
            set({ isLoading: true, error: null });
            const transactions = await walletService.getTransactions(address, limit);
            set({ transactions, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to fetch transactions',
              isLoading: false
            });
          }
        },

        withdraw: async ({ toAddress, amount }) => {
          const state = get();
          if (!state.address || !state.secretKey) {
            throw new Error('Wallet not initialized');
          }

          try {
            set({ pendingWithdrawal: true, error: null });
            const result = await walletService.withdraw({
              fromAddress: state.address,
              toAddress,
              amount,
              secretKey: state.secretKey
            });

            // Refresh balance and transactions after withdrawal
            await state.fetchBalance(state.address);
            await state.fetchTransactions(state.address);

            set({ pendingWithdrawal: false });
            return result;
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Withdrawal failed',
              pendingWithdrawal: false
            });
            throw error;
          }
        },

        createWallet: async (mnemonic) => {
          try {
            set({ isLoading: true, error: null });
            const { address, secretKey } = await walletService.createWallet(mnemonic);
            set({
              address,
              secretKey,
              isLoading: false
            });

            // Initialize wallet data
            await get().fetchBalance(address);
            await get().fetchTransactions(address);
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to create wallet',
              isLoading: false
            });
            throw error;
          }
        },

        reset: () => set({
          address: null,
          balance: null,
          transactions: [],
          isLoading: false,
          error: null,
          secretKey: null,
          pendingWithdrawal: false
        })
      }),
      {
        name: 'wallet-storage',
        partialize: (state) => ({
          address: state.address,
          // Don't persist sensitive data like secretKey
        })
      }
    )
  )
); 