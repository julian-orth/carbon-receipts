import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'
import { FullPageSpinner } from './FullPageSpinner'

export type LoginLocationState = { from?: string }

/** Layout route: renders children only for signed-in users. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageSpinner label="Sitzung wird geprüft" />

  if (auth.status === 'unauthenticated') {
    const state: LoginLocationState = {
      from: `${location.pathname}${location.search}${location.hash}`,
    }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}
