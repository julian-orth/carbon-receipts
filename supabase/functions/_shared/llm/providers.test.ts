import { describe, expect, it, vi } from 'vitest'
import { createGeminiProvider } from './gemini.ts'
import { createGroqProvider } from './groq.ts'
import { LlmError, parseModelJson } from './types.ts'

const image = { mimeType: 'image/jpeg', base64: 'AAAA' }
const request = { system: 'system', prompt: 'prompt', image }

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

function sentBody(fetchMock: ReturnType<typeof fakeFetch>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1]
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

describe('createGeminiProvider', () => {
  it('sends the image inline, asks for JSON and parses the answer', async () => {
    const fetchMock = fakeFetch(200, {
      candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }],
    })
    const gemini = createGeminiProvider({ apiKey: 'key', model: 'gemini-test', fetch: fetchMock })

    await expect(gemini.generateJson(request)).resolves.toEqual({ items: [] })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain('/models/gemini-test:generateContent')
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('key')
    expect(sentBody(fetchMock)).toMatchObject({
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      contents: [
        { parts: [{ text: 'prompt' }, { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }] },
      ],
    })
  })

  it.each([
    [429, true],
    [503, true],
    [400, false],
  ])('maps HTTP %d to retryable=%s', async (status, retryable) => {
    const gemini = createGeminiProvider({ apiKey: 'k', model: 'm', fetch: fakeFetch(status, {}) })
    await expect(gemini.generateJson(request)).rejects.toMatchObject({ status, retryable })
  })

  it('fails on empty candidates', async () => {
    const gemini = createGeminiProvider({
      apiKey: 'k',
      model: 'm',
      fetch: fakeFetch(200, { candidates: [{ finishReason: 'SAFETY' }] }),
    })
    await expect(gemini.generateJson(request)).rejects.toThrow(/SAFETY/)
  })
})

describe('createGroqProvider', () => {
  it('uses the OpenAI-compatible format with a data URL', async () => {
    const fetchMock = fakeFetch(200, { choices: [{ message: { content: '{"items":[]}' } }] })
    const groq = createGroqProvider({ apiKey: 'key', model: 'llama-test', fetch: fetchMock })

    await expect(groq.generateJson(request)).resolves.toEqual({ items: [] })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer key')
    expect(sentBody(fetchMock)).toMatchObject({
      model: 'llama-test',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'system' },
        {
          role: 'user',
          content: [
            { type: 'text' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
          ],
        },
      ],
    })
  })

  it('marks 429 as retryable', async () => {
    const groq = createGroqProvider({ apiKey: 'k', model: 'm', fetch: fakeFetch(429, {}) })
    await expect(groq.generateJson(request)).rejects.toBeInstanceOf(LlmError)
    await expect(groq.generateJson(request)).rejects.toMatchObject({ retryable: true })
  })
})

describe('parseModelJson', () => {
  it('strips markdown fences', () => {
    expect(parseModelJson('```json\n{"a":1}\n```', 'x')).toEqual({ a: 1 })
  })

  it('throws an LlmError for invalid JSON', () => {
    expect(() => parseModelJson('not json', 'x')).toThrow(LlmError)
  })
})
