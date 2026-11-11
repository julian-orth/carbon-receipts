import { z } from 'zod'
import {
  DEFAULT_TIMEOUT_MS,
  type FetchFn,
  fetchWithTimeout,
  isRetryableStatus,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  MAX_OUTPUT_TOKENS,
  parseModelJson,
} from './types.ts'
import { parseDurationMs, parseRetryAfterMs } from './quota.ts'

/** A 429 asking for a longer wait than this is a daily limit, not a per-minute one. */
const DAILY_LIMIT_THRESHOLD_MS = 60_000

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({ message: z.object({ content: z.string().nullable().optional() }).optional() }),
    )
    .optional(),
})

/** Groq exposes an OpenAI-compatible chat completions API. */
export function createGroqProvider(options: {
  apiKey: string
  model: string
  fetch?: FetchFn
  timeoutMs?: number
}): LlmProvider {
  const fetchFn = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const name = `groq:${options.model}`
  let exhaustedUntil: Date | undefined

  return {
    name,
    quotaExhaustedUntil: () => exhaustedUntil,
    async generateJson(request: LlmRequest, signal?: AbortSignal) {
      const content: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }]
      if (request.image) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` },
        })
      }

      const response = await fetchWithTimeout(
        fetchFn,
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({
            model: options.model,
            temperature: 0,
            max_tokens: MAX_OUTPUT_TOKENS,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content },
            ],
          }),
        },
        { provider: name, timeoutMs, signal },
      )

      if (!response.ok) {
        const retryAfterMs =
          response.status === 429
            ? parseRetryAfterMs(response.headers.get('retry-after'))
            : undefined
        const daily = retryAfterMs !== undefined && retryAfterMs > DAILY_LIMIT_THRESHOLD_MS
        throw new LlmError(`Groq request failed with ${response.status}`, {
          provider: name,
          status: response.status,
          retryable: !daily && isRetryableStatus(response.status),
          ...(daily && { exhaustedUntil: new Date(Date.now() + retryAfterMs) }),
        })
      }

      // Groq reports the remaining daily requests on every response: when the last one was
      // just used, the next call would only run into a 429.
      if (response.headers.get('x-ratelimit-remaining-requests') === '0') {
        const resetMs = parseDurationMs(response.headers.get('x-ratelimit-reset-requests'))
        if (resetMs !== undefined) exhaustedUntil = new Date(Date.now() + resetMs)
      }

      const parsed = chatCompletionSchema.safeParse(await response.json())
      if (!parsed.success)
        throw new LlmError('Groq returned an unexpected response', { provider: name })
      const body = parsed.data
      const text = body.choices?.[0]?.message?.content
      if (!text) throw new LlmError('Groq returned no content', { provider: name })
      return parseModelJson(text, name)
    },
  }
}
