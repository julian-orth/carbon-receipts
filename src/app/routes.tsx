import type { RouteObject } from 'react-router'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'
import { RootLayout } from './RootLayout'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
