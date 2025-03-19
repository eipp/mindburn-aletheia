import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Task, UserProfile, TaskSubmission } from '@/types';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL,
    prepareHeaders: headers => {
      const telegram = window.Telegram.WebApp;
      headers.set('X-Telegram-Init-Data', telegram.initData);
      return headers;
    },
  }),
  tagTypes: ['Tasks', 'User'],
  endpoints: builder => ({
    getTasks: builder.query<Task[], void>({
      query: () => '/tasks',
      providesTags: ['Tasks'],
    }),
    getTask: builder.query<Task, string>({
      query: id => `/tasks/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Tasks', id }],
    }),
    submitTask: builder.mutation<void, TaskSubmission>({
      query: ({ taskId, answer }) => ({
        url: `/tasks/${taskId}/submit`,
        method: 'POST',
        body: { answer },
      }),
      invalidatesTags: (_result, _error, { taskId }) => [{ type: 'Tasks', id: taskId }, 'Tasks'],
    }),
    getUserProfile: builder.query<UserProfile, void>({
      query: () => '/user/profile',
      providesTags: ['User'],
    }),
    updateUserProfile: builder.mutation<void, Partial<UserProfile>>({
      query: profile => ({
        url: '/user/profile',
        method: 'PATCH',
        body: profile,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});
