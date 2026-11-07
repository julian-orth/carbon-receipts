import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, toAuthState, type AuthState } from './auth-context'

const LOADING: AuthState = { status: 'loading', session: null, user: null }

/**
 * Session is client state owned by supabase-js, so it lives in context rather than
 * TanStack Query. `INITIAL_SESSION` fires once the client has restored the session
 * (or exchanged a magic-link code), which ends the loading state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(LOADING)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState(toAuthState(session))
      if (event === 'SIGNED_OUT') {
        // Never leak cached data of the previous user.
        queryClient.clear()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
