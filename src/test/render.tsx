import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { unauthenticated } from './auth'

type RenderRoutesOptions = {
  initialPath?: string
  initialState?: unknown
  auth?: AuthState
}

/**
 * Renders a route tree in memory with a fresh, retry-free QueryClient and a fixed
 * auth state (no Supabase involved).
 */
export function renderRoutes(routes: RouteObject[], options: RenderRoutesOptions = {}) {
  const { initialPath = '/', initialState, auth = unauthenticated } = options
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: initialPath, state: initialState }],
  })
  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </QueryClientProvider>,
    ),
  }
}
