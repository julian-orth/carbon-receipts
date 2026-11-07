import type { Session, User } from '@supabase/supabase-js'
import type { AuthState } from '@/features/auth/auth-context'

export const testUser: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'alice@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}

export const testSession: Session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  user: testUser,
}

export const authenticated: AuthState = {
  status: 'authenticated',
  session: testSession,
  user: testUser,
}
export const unauthenticated: AuthState = { status: 'unauthenticated', session: null, user: null }
export const loading: AuthState = { status: 'loading', session: null, user: null }
