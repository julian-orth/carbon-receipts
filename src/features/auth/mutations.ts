import { useMutation } from '@tanstack/react-query'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export function useSendMagicLink() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      })
      if (error) throw error
    },
  })
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  })
}

export const demoCredentials =
  env.VITE_DEMO_EMAIL && env.VITE_DEMO_PASSWORD
    ? { email: env.VITE_DEMO_EMAIL, password: env.VITE_DEMO_PASSWORD }
    : null

export function useDemoSignIn() {
  return useMutation({
    mutationFn: async () => {
      if (!demoCredentials) throw new Error('Demo account is not configured')
      const { error } = await supabase.auth.signInWithPassword(demoCredentials)
      if (error) throw error
    },
  })
}
