export type LlmImage = { mimeType: string; base64: string }

export type LlmRequest = {
  system: string
  prompt: string
  image?: LlmImage
}

/** A provider returns parsed JSON; validation happens in the caller. */
export interface LlmProvider {
  readonly name: string
  generateJson(request: LlmRequest, signal?: AbortSignal): Promise<unknown>
}

export class LlmError extends Error {
  readonly provider: string
  readonly status: number | undefined
  /** 429 and 5xx: worth retrying the same provider after a delay. */
  readonly retryable: boolean

  constructor(
    message: string,
    options: { provider: string; status?: number; retryable?: boolean },
  ) {
    super(message)
    this.name = 'LlmError'
    this.provider = options.provider
    this.status = options.status
    this.retryable = options.retryable ?? false
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
