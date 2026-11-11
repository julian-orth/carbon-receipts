import { LlmError, type LlmProvider, type LlmRequest } from './types.ts'

export type RetryOptions = {
  /** Retries per provider after the first attempt. */
  retries: number
  baseDelayMs: number
  maxDelayMs: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const DEFAULT_RETRY: RetryOptions = { retries: 2, baseDelayMs: 750, maxDelayMs: 6000 }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Exponential backoff with "full jitter": delay ∈ [0, min(max, base · 2^attempt)). */
export function backoffDelay(attempt: number, options: RetryOptions): number {
  const cap = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt)
  return Math.floor((options.random ?? Math.random)() * cap)
}

export type ProviderAttempt = { provider: string; attempt: number; error: string }

export type FallbackHooks = {
  /** Called once before a provider's first attempt (e.g. to show a fallback in the UI). */
  onProviderStart?: (provider: string) => void | Promise<void>
  /** A provider's quota is used up until `until` (circuit breaker: persist it, skip it meanwhile). */
  onExhausted?: (provider: string, until: Date) => void | Promise<void>
}

export class AllProvidersFailedError extends Error {
  readonly attempts: ProviderAttempt[]
  constructor(attempts: ProviderAttempt[]) {
    super(
      `All LLM providers failed: ${attempts.map((a) => `${a.provider}#${a.attempt}: ${a.error}`).join('; ')}`,
    )
    this.name = 'AllProvidersFailedError'
    this.attempts = attempts
  }
}

/**
 * Runs the request against each provider in order. Retryable errors (429/5xx)
 * are retried with backoff – except 503 "overloaded": a model under high demand stays
 * overloaded for minutes, so waiting for it only delays the fallback. Anything else –
 * including output that fails `parse` (e.g. Zod validation) – moves on to the next
 * provider. `attempts` lists the failures before the success (for logging).
 */
export async function generateWithFallback<T>(
  providers: readonly LlmProvider[],
  request: LlmRequest,
  parse: (raw: unknown) => T,
  options: RetryOptions = DEFAULT_RETRY,
  hooks: FallbackHooks = {},
): Promise<{ value: T; provider: string; attempts: ProviderAttempt[] }> {
  const sleep = options.sleep ?? defaultSleep
  const attempts: ProviderAttempt[] = []

  for (const provider of providers) {
    await hooks.onProviderStart?.(provider.name)
    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const raw = await provider.generateJson(request)
        const value = parse(raw)
        const until = provider.quotaExhaustedUntil?.()
        if (until) await hooks.onExhausted?.(provider.name, until)
        return { value, provider: provider.name, attempts }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        attempts.push({ provider: provider.name, attempt, error: message })
        if (error instanceof LlmError && error.exhaustedUntil) {
          await hooks.onExhausted?.(provider.name, error.exhaustedUntil)
          break
        }
        const retryable = error instanceof LlmError && error.retryable && error.status !== 503
        if (!retryable || attempt === options.retries) break
        await sleep(backoffDelay(attempt, options))
      }
    }
  }

  throw new AllProvidersFailedError(attempts)
}
