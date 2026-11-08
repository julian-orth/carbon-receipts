import {
  DEFAULT_TIMEOUT_MS,
  type FetchFn,
  fetchWithTimeout,
  isRetryableStatus,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  parseModelJson,
} from './types.ts'

type ChatCompletionResponse = { choices?: Array<{ message?: { content?: string | null } }> }

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

  return {
    name,
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
        throw new LlmError(`Groq request failed with ${response.status}`, {
          provider: name,
          status: response.status,
          retryable: isRetryableStatus(response.status),
        })
      }

      const body = (await response.json()) as ChatCompletionResponse
      const text = body.choices?.[0]?.message?.content
      if (!text) throw new LlmError('Groq returned no content', { provider: name })
      return parseModelJson(text, name)
    },
  }
}
