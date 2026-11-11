type LlmImage = { mimeType: string; base64: string }

export type LlmRequest = {
  system: string
  prompt: string
  image?: LlmImage
}

/** A provider returns parsed JSON; validation happens in the caller. */
export interface LlmProvider {
  readonly name: string
  generateJson(request: LlmRequest, signal?: AbortSignal): Promise<unknown>
  /**
   * Set when the provider reported (e.g. via rate-limit headers) that its quota is used up
   * after a successful call, so the next request can skip it instead of running into a 429.
   */
  quotaExhaustedUntil?(): Date | undefined
}

export class LlmError extends Error {
  readonly provider: string
  readonly status: number | undefined
  /** 429 and 5xx: worth retrying the same provider after a delay. */
  readonly retryable: boolean
  /** The quota is used up until then (daily limits): do not retry, skip the provider meanwhile. */
  readonly exhaustedUntil: Date | undefined

  constructor(
    message: string,
    options: { provider: string; status?: number; retryable?: boolean; exhaustedUntil?: Date },
  ) {
    super(message)
    this.name = 'LlmError'
    this.provider = options.provider
    this.status = options.status
    this.retryable = options.retryable ?? false
    this.exhaustedUntil = options.exhaustedUntil
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export type FetchFn = typeof fetch

/** Parses JSON text from a model, tolerating ```json fences. */
export function parseModelJson(text: string, provider: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new LlmError('Model returned invalid JSON', { provider })
  }
}

/** Output cap per request: receipts are small, a runaway answer must not eat the token quota. */
export const MAX_OUTPUT_TOKENS = 4096

/** Per-request limit. Edge functions have a wall-clock budget, so a hanging model must not eat it. */
export const DEFAULT_TIMEOUT_MS = 30_000

/**
 * fetch with a timeout. A timeout is not retried on the same provider (it already cost
 * the full budget) – the caller moves on to the next one. Network errors are retryable.
 */
export async function fetchWithTimeout(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  options: { provider: string; timeoutMs: number; signal?: AbortSignal | undefined },
): Promise<Response> {
  const timeout = AbortSignal.timeout(options.timeoutMs)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  try {
    return await fetchFn(url, { ...init, signal })
  } catch (error) {
    if (timeout.aborted) {
      throw new LlmError(`${options.provider} timed out after ${options.timeoutMs} ms`, {
        provider: options.provider,
      })
    }
    throw new LlmError(
      `${options.provider} request failed: ${error instanceof Error ? error.message : String(error)}`,
      { provider: options.provider, retryable: true },
    )
  }
}
