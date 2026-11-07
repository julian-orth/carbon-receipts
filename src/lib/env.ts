import { z } from 'zod'

/** `VITE_X=` (empty) in an env file means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional())

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Optional public demo account (password login); the button is hidden without it.
  VITE_DEMO_EMAIL: optional(z.email()),
  VITE_DEMO_PASSWORD: optional(z.string().min(1)),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env = parseEnv(import.meta.env)
