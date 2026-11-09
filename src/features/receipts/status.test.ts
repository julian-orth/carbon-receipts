import { describe, expect, it } from 'vitest'
import { canStartProcessing, STUCK_AFTER_MS } from './status'

const now = Date.parse('2026-11-09T12:00:00Z')
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

describe('canStartProcessing', () => {
  it('allows pending receipts', () => {
    expect(canStartProcessing({ status: 'pending', updated_at: minutesAgo(0) }, now)).toBe(true)
  })

  it('allows a restart only when processing looks stuck', () => {
    expect(canStartProcessing({ status: 'processing', updated_at: minutesAgo(1) }, now)).toBe(false)
    expect(canStartProcessing({ status: 'processing', updated_at: minutesAgo(6) }, now)).toBe(true)
    expect(STUCK_AFTER_MS).toBe(5 * 60_000)
  })

  it.each(['review', 'done', 'failed'] as const)('never for %s', (status) => {
    expect(canStartProcessing({ status, updated_at: minutesAgo(60) }, now)).toBe(false)
  })
})
