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

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
}

export function createGeminiProvider(options: {
  apiKey: string
  model: string
  fetch?: FetchFn
  timeoutMs?: number
}): LlmProvider {
  const fetchFn = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const name = `gemini:${options.model}`

  return {
    name,
    async generateJson(request: LlmRequest, signal?: AbortSignal) {
      const parts: Array<Record<string, unknown>> = [{ text: request.prompt }]
      if (request.image) {
        parts.push({
          inline_data: { mime_type: request.image.mimeType, data: request.image.base64 },
        })
      }

      const response = await fetchWithTimeout(
        fetchFn,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
          }),
        },
        { provider: name, timeoutMs, signal },
      )

      if (!response.ok) {
        throw new LlmError(`Gemini request failed with ${response.status}`, {
          provider: name,
          status: response.status,
          retryable: isRetryableStatus(response.status),
        })
      }

      const body = (await response.json()) as GeminiResponse
      const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
      if (!text) {
        throw new LlmError(
          `Gemini returned no content (${body.candidates?.[0]?.finishReason ?? 'unknown'})`,
          { provider: name },
        )
      }
      return parseModelJson(text, name)
    },
  }
}
