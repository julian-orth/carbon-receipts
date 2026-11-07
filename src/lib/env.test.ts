import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('accepts a valid configuration', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    })
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
  })

  it('names every missing or invalid variable', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'not-a-url' })).toThrow(
      /VITE_SUPABASE_URL[\s\S]*VITE_SUPABASE_PUBLISHABLE_KEY/,
    )
  })

  it('treats empty optional values as not set', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      VITE_DEMO_EMAIL: '',
      VITE_DEMO_PASSWORD: '',
    })
    expect(env.VITE_DEMO_EMAIL).toBeUndefined()
    expect(env.VITE_DEMO_PASSWORD).toBeUndefined()
  })
})
