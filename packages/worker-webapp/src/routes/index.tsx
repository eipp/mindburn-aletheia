import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { LoadingOverlay } from '@mantine/core';
import Layout from '@/components/Layout';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const TaskDetails = lazy(() => import('@/pages/TaskDetails'));
const Profile = lazy(() => import('@/pages/Profile'));
const Wallet = lazy(() => import('@/pages/Wallet'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingOverlay visible />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'tasks',
        element: (
          <Suspense fallback={<LoadingOverlay visible />}>
            <Tasks />
          </Suspense>
        ),
      },
      {
        path: 'tasks/:taskId',
        element: (
          <Suspense fallback={<LoadingOverlay visible />}>
            <TaskDetails />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<LoadingOverlay visible />}>
            <Profile />
          </Suspense>
        ),
      },
      {
        path: 'wallet',
        element: (
          <Suspense fallback={<LoadingOverlay visible />}>
            <Wallet />
          </Suspense>
        ),
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
} 