import { LlmError, type LlmProvider, type LlmRequest } from './types.ts'

export type RetryOptions = {
  /** Retries per provider after the first attempt. */
  retries: number
  baseDelayMs: number
  maxDelayMs: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export const DEFAULT_RETRY: RetryOptions = { retries: 2, baseDelayMs: 750, maxDelayMs: 6000 }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Exponential backoff with "full jitter": delay ∈ [0, min(max, base · 2^attempt)). */
export function backoffDelay(attempt: number, options: RetryOptions): number {
  const cap = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt)
  return Math.floor((options.random ?? Math.random)() * cap)
}

export type ProviderAttempt = { provider: string; attempt: number; error: string }

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
 * are retried with backoff; anything else – including output that fails
 * `parse` (e.g. Zod validation) – moves on to the next provider.
 */
export async function generateWithFallback<T>(
  providers: readonly LlmProvider[],
  request: LlmRequest,
  parse: (raw: unknown) => T,
  options: RetryOptions = DEFAULT_RETRY,
): Promise<{ value: T; provider: string }> {
  const sleep = options.sleep ?? defaultSleep
  const attempts: ProviderAttempt[] = []

  for (const provider of providers) {
    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const raw = await provider.generateJson(request)
        return { value: parse(raw), provider: provider.name }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        attempts.push({ provider: provider.name, attempt, error: message })
        const retryable = error instanceof LlmError && error.retryable
        if (!retryable || attempt === options.retries) break
        await sleep(backoffDelay(attempt, options))
      }
    }
  }

  throw new AllProvidersFailedError(attempts)
}
