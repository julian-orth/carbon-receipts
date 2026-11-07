import { beforeEach, describe, expect, it } from 'vitest'
import { consumeRedirect, DEFAULT_REDIRECT, rememberRedirect, sanitizeRedirect } from './redirect'

describe('sanitizeRedirect', () => {
  it.each([
    ['/receipts', '/receipts'],
    ['/receipts/42?tab=items#x', '/receipts/42?tab=items#x'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(sanitizeRedirect(input)).toBe(expected)
  })

  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['receipts'],
    ['/login'],
    ['/auth/callback'],
    [''],
    [null],
    [42],
  ])('falls back to the default for %s', (input) => {
    expect(sanitizeRedirect(input)).toBe(DEFAULT_REDIRECT)
  })
})

describe('rememberRedirect / consumeRedirect', () => {
  beforeEach(() => localStorage.clear())

  it('returns the remembered path exactly once', () => {
    rememberRedirect('/receipts')
    expect(consumeRedirect()).toBe('/receipts')
    expect(consumeRedirect()).toBe(DEFAULT_REDIRECT)
  })

  it('never stores an unsafe target', () => {
    rememberRedirect('//evil.com')
    expect(consumeRedirect()).toBe(DEFAULT_REDIRECT)
  })
})
