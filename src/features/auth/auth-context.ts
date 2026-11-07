import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'loading'; session: null; user: null }
  | { status: 'unauthenticated'; session: null; user: null }
  | { status: 'authenticated'; session: Session; user: User }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

export function toAuthState(session: Session | null): AuthState {
  return session
    ? { status: 'authenticated', session, user: session.user }
    : { status: 'unauthenticated', session: null, user: null }
}
