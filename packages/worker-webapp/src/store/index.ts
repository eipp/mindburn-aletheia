import { configureStore } from '@reduxjs/toolkit';
import tasksReducer from './slices/tasksSlice';
import userReducer from './slices/userSlice';
import walletReducer from './slices/walletSlice';
import paymentReducer from './slices/paymentSlice';
import { apiSlice } from './api/apiSlice';

export const store = configureStore({
  reducer: {
    tasks: tasksReducer,
    user: userReducer,
    wallet: walletReducer,
    payment: paymentReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 