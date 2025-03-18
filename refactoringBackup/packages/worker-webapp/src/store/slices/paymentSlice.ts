import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { paymentService } from '@/services/payment';
import { tonService } from '@/services/ton';

interface PaymentState {
  transactions: {
    items: any[];
    loading: boolean;
    error: string | null;
  };
  pendingRewards: {
    total: string;
    loading: boolean;
    error: string | null;
  };
  processing: boolean;
  error: string | null;
}

const initialState: PaymentState = {
  transactions: {
    items: [],
    loading: false,
    error: null,
  },
  pendingRewards: {
    total: '0',
    loading: false,
    error: null,
  },
  processing: false,
  error: null,
};

export const processReward = createAsyncThunk(
  'payment/processReward',
  async ({
    taskId,
    workerAddress,
    amount,
  }: {
    taskId: string;
    workerAddress: string;
    amount: string;
  }) => {
    const result = await paymentService.processReward(taskId, workerAddress, amount);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  }
);

export const fetchTransactionHistory = createAsyncThunk(
  'payment/fetchTransactionHistory',
  async (address: string) => {
    const history = await tonService.getTransactionHistory(address);
    return history;
  }
);

export const fetchPendingRewards = createAsyncThunk(
  'payment/fetchPendingRewards',
  async (address: string) => {
    // Implement fetching pending rewards from contract
    return '0';
  }
);

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Process reward
      .addCase(processReward.pending, (state) => {
        state.processing = true;
        state.error = null;
      })
      .addCase(processReward.fulfilled, (state) => {
        state.processing = false;
      })
      .addCase(processReward.rejected, (state, action) => {
        state.processing = false;
        state.error = action.error.message || 'Failed to process reward';
      })
      // Transaction history
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.transactions.loading = true;
        state.transactions.error = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        state.transactions.loading = false;
        state.transactions.items = action.payload;
      })
      .addCase(fetchTransactionHistory.rejected, (state, action) => {
        state.transactions.loading = false;
        state.transactions.error = action.error.message || 'Failed to fetch transactions';
      })
      // Pending rewards
      .addCase(fetchPendingRewards.pending, (state) => {
        state.pendingRewards.loading = true;
        state.pendingRewards.error = null;
      })
      .addCase(fetchPendingRewards.fulfilled, (state, action) => {
        state.pendingRewards.loading = false;
        state.pendingRewards.total = action.payload;
      })
      .addCase(fetchPendingRewards.rejected, (state, action) => {
        state.pendingRewards.loading = false;
        state.pendingRewards.error = action.error.message || 'Failed to fetch pending rewards';
      });
  },
});

export const { clearError } = paymentSlice.actions;
export default paymentSlice.reducer; 