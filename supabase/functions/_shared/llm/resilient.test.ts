import { assert, describe, expect, it, vi } from 'vitest'
import {
  AllProvidersFailedError,
  backoffDelay,
  generateWithFallback,
  type RetryOptions,
} from './resilient.ts'
import { LlmError, type LlmProvider } from './types.ts'

const request = { system: 's', prompt: 'p' }
const noWait: RetryOptions = {
  retries: 2,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  sleep: () => Promise.resolve(),
  random: () => 0.5,
}

type FakeProvider = LlmProvider & { readonly calls: number }

/** Returns the given results in order; the last one repeats. */
function provider(name: string, ...results: unknown[]): FakeProvider {
  const generateJson = vi.fn<LlmProvider['generateJson']>(() => {
    const result: unknown =
      results[Math.min(generateJson.mock.calls.length - 1, results.length - 1)]
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  })
  return {
    name,
    generateJson,
    get calls() {
      return generateJson.mock.calls.length
    },
  }
}

const rateLimited = (name: string) =>
  new LlmError('429', { provider: name, status: 429, retryable: true })
const badRequest = (name: string) => new LlmError('400', { provider: name, status: 400 })
const identity = (raw: unknown) => raw
const requireOk = (raw: unknown) => {
  if (typeof raw === 'object' && raw !== null && 'ok' in raw) return raw
  throw new Error('invalid shape')
}

describe('generateWithFallback', () => {
  it('returns the first successful result', async () => {
    const gemini = provider('gemini', { ok: 1 })
    const groq = provider('groq', { ok: 2 })
    await expect(generateWithFallback([gemini, groq], request, identity, noWait)).resolves.toEqual({
      value: { ok: 1 },
      provider: 'gemini',
      attempts: [],
    })
    expect(groq.calls).toBe(0)
  })

  it('retries retryable errors with backoff before succeeding', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())
    const gemini = provider('gemini', rateLimited('gemini'), rateLimited('gemini'), { ok: 1 })
    const result = await generateWithFallback([gemini], request, identity, { ...noWait, sleep })
    expect(result.provider).toBe('gemini')
    expect(gemini.calls).toBe(3)
    expect(sleep.mock.calls).toEqual([[50], [100]]) // 0.5 · 100 · 2^0, 0.5 · 100 · 2^1
  })

  it('falls back after the retries are exhausted', async () => {
    const gemini = provider('gemini', rateLimited('gemini'))
    const groq = provider('groq', { ok: 2 })
    const result = await generateWithFallback([gemini, groq], request, identity, noWait)
    expect(result).toMatchObject({ value: { ok: 2 }, provider: 'groq' })
    expect(result.attempts.map((a) => `${a.provider}#${a.attempt}`)).toEqual([
      'gemini#0',
      'gemini#1',
      'gemini#2',
    ])
    expect(gemini.calls).toBe(3)
  })

  it('skips an overloaded model (503) right away instead of waiting for it', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())
    const overloaded = new LlmError('503', { provider: 'gemini', status: 503, retryable: true })
    const gemini = provider('gemini', overloaded)
    const groq = provider('groq', { ok: 2 })
    const result = await generateWithFallback([gemini, groq], request, identity, {
      ...noWait,
      sleep,
    })
    expect(result.provider).toBe('groq')
    expect(gemini.calls).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('does not retry non-retryable errors', async () => {
    const gemini = provider('gemini', badRequest('gemini'))
    const groq = provider('groq', { ok: 2 })
    await generateWithFallback([gemini, groq], request, identity, noWait)
    expect(gemini.calls).toBe(1)
  })

  it('falls back when the output fails validation', async () => {
    const gemini = provider('gemini', { wrong: true })
    const groq = provider('groq', { ok: 2 })
    await expect(
      generateWithFallback([gemini, groq], request, requireOk, noWait),
    ).resolves.toMatchObject({
      provider: 'groq',
    })
  })

  it('reports every attempt when all providers fail', async () => {
    const gemini = provider('gemini', badRequest('gemini'))
    const groq = provider('groq', rateLimited('groq'))
    const error = await generateWithFallback([gemini, groq], request, identity, noWait).catch(
      (e: unknown) => e,
    )
    assert(error instanceof AllProvidersFailedError)
    expect(error.attempts.map((a) => a.provider)).toEqual(['gemini', 'groq', 'groq', 'groq'])
  })

  it('announces each provider once, before its first attempt', async () => {
    const gemini = provider('gemini', rateLimited('gemini'))
    const groq = provider('groq', { ok: true })
    const started: string[] = []
    await generateWithFallback([gemini, groq], request, identity, noWait, {
      onProviderStart: (name) => {
        started.push(`${name}@${gemini.calls + groq.calls}`)
      },
    })
    // gemini before any call, groq after gemini's three attempts
    expect(started).toEqual(['gemini@0', 'groq@3'])
  })
})

describe('backoffDelay', () => {
  it('grows exponentially and is capped', () => {
    const options = { retries: 5, baseDelayMs: 100, maxDelayMs: 500, random: () => 0.999 }
    expect([0, 1, 2, 3, 4].map((attempt) => backoffDelay(attempt, options))).toEqual([
      99, 199, 399, 499, 499,
    ])
  })
})
