import type { RouteObject } from 'react-router'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NotFoundPage } from './NotFoundPage'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

// Feature pages are code-split; the dashboard pulls in Recharts.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/dashboard/DashboardPage')).DashboardPage,
            }),
          },
          {
            path: 'receipts',
            lazy: async () => ({
              Component: (await import('@/features/receipts/ReceiptsPage')).ReceiptsPage,
            }),
          },
          {
            path: 'datenbasis',
            lazy: async () => ({
              Component: (await import('@/features/factors/FactorsPage')).FactorsPage,
            }),
          },
          {
            path: 'receipts/:receiptId',
            lazy: async () => ({
              Component: (await import('@/features/review/ReviewPage')).ReviewPage,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
