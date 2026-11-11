import { describe, expect, it } from 'vitest'
import { nextMidnight, parseDurationMs, parseRetryAfterMs, quotaExhaustedMessage } from './quota.ts'

describe('parseRetryAfterMs', () => {
  it('reads seconds', () => {
    expect(parseRetryAfterMs('7')).toBe(7000)
    expect(parseRetryAfterMs('0.5')).toBe(500)
  })
  it('ignores missing or invalid values', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined()
    expect(parseRetryAfterMs('soon')).toBeUndefined()
  })
})

describe('parseDurationMs', () => {
  it('reads Groq reset headers', () => {
    expect(parseDurationMs('59.56s')).toBe(59_560)
    expect(parseDurationMs('2m59.56s')).toBe(179_560)
    expect(parseDurationMs('1h2m3s')).toBe(3_723_000)
    expect(parseDurationMs('250ms')).toBe(250)
  })
  it('ignores garbage', () => {
    expect(parseDurationMs('')).toBeUndefined()
    expect(parseDurationMs('later')).toBeUndefined()
    expect(parseDurationMs(null)).toBeUndefined()
  })
})

describe('nextMidnight', () => {
  it('finds midnight Pacific during daylight saving time (UTC-7)', () => {
    // 2026-07-10 20:00 in Los Angeles → next midnight is 2026-07-11 00:00 PDT = 07:00 UTC
    const result = nextMidnight(new Date('2026-07-11T03:00:00Z'), 'America/Los_Angeles')
    expect(result.toISOString()).toBe('2026-07-11T07:00:00.000Z')
  })
  it('finds midnight Pacific in winter (UTC-8)', () => {
    const result = nextMidnight(new Date('2026-11-11T12:00:00Z'), 'America/Los_Angeles')
    expect(result.toISOString()).toBe('2026-11-12T08:00:00.000Z')
  })
  it('is always in the future and at most a day away', () => {
    const now = new Date('2026-11-11T07:59:59Z')
    const result = nextMidnight(now, 'America/Los_Angeles')
    expect(result.getTime()).toBeGreaterThan(now.getTime())
    expect(result.getTime() - now.getTime()).toBeLessThanOrEqual(24 * 3_600_000)
  })
})

describe('quotaExhaustedMessage', () => {
  it('says "ab ca. HH:MM Uhr" for the same day (Berlin)', () => {
    const now = new Date('2026-11-11T05:00:00Z')
    const until = new Date('2026-11-11T08:00:00Z') // 09:00 in Berlin
    expect(quotaExhaustedMessage(until, now)).toContain('ab ca. 09:00 Uhr')
  })
  it('says "morgen" for the next day', () => {
    const now = new Date('2026-11-11T12:00:00Z')
    const until = new Date('2026-11-12T08:00:00Z')
    expect(quotaExhaustedMessage(until, now)).toContain('ab ca. morgen 09:00 Uhr')
  })
})
