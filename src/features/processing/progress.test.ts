import { describe, expect, it } from 'vitest'
import type { LineItem } from '@/features/review/review-logic'
import { summarize, toPaperLine } from './progress'
import { ALL_DONE, displayTarget, isFromUpload, serverStepIndex, STEP } from './steps'

function item(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: crypto.randomUUID(),
    receipt_id: 'r1',
    user_id: 'u1',
    position: 1,
    raw_text: 'Bergkäse',
    normalized_name: 'bergkase',
    quantity: 0.3,
    unit: 'kg',
    quantity_source: 'receipt',
    price: 6.9,
    category_id: 'cheese',
    confidence: 0.95,
    reviewed: false,
    co2e_kg: 1.71,
    created_at: '2026-11-09T10:00:00Z',
    updated_at: '2026-11-09T10:00:00Z',
    ...overrides,
  }
}

describe('serverStepIndex', () => {
  it('maps the pipeline step reported by the edge function', () => {
    expect(serverStepIndex({ status: 'pending', processing_step: null })).toBe(STEP.read)
    expect(serverStepIndex({ status: 'processing', processing_step: null })).toBe(STEP.read)
    expect(serverStepIndex({ status: 'processing', processing_step: 'validating' })).toBe(
      STEP.validate,
    )
    expect(serverStepIndex({ status: 'processing', processing_step: 'calculating' })).toBe(
      STEP.calculate,
    )
    expect(serverStepIndex({ status: 'review', processing_step: null })).toBe(ALL_DONE)
    expect(serverStepIndex({ status: 'done', processing_step: null })).toBe(ALL_DONE)
  })

  it('keeps the step where a run failed', () => {
    expect(serverStepIndex({ status: 'failed', processing_step: 'matching' })).toBe(STEP.match)
  })
})

describe('displayTarget', () => {
  it('waits at "Prüfen" until the line items are loaded', () => {
    expect(displayTarget(ALL_DONE, false)).toBe(STEP.validate)
    expect(displayTarget(STEP.match, false)).toBe(STEP.validate)
    expect(displayTarget(ALL_DONE, true)).toBe(ALL_DONE)
    expect(displayTarget(STEP.read, false)).toBe(STEP.read)
  })
})

describe('summarize', () => {
  it('sums known CO2e values and counts open items', () => {
    const summary = summarize([
      item({ co2e_kg: 1.71 }),
      item({ co2e_kg: 6.8, quantity_source: 'learned' }),
      item({ co2e_kg: null, quantity: null }),
      item({ co2e_kg: 0.4, quantity_source: 'estimated' }),
    ])
    expect(summary).toEqual({
      count: 4,
      withCo2e: 3,
      totalKg: 8.91,
      attention: 2,
      learned: 1,
      estimated: 1,
    })
  })
})

describe('toPaperLine', () => {
  it('formats price and amount and marks lines that need a look', () => {
    const line = toPaperLine(item({ price: 6.9, quantity: 0.3, unit: 'kg' }))
    expect(line.price).toMatch(/^6,90\s€$/)
    expect(line.quantity).toBe('0,3 kg')
    expect(toPaperLine(item({ quantity_source: 'estimated' })).quantity).toMatch(/^~/)
    expect(toPaperLine(item({ category_id: null, reviewed: false })).needsLook).toBe(true)
  })
})

describe('isFromUpload', () => {
  it('only accepts the state set by the upload', () => {
    expect(isFromUpload({ fromUpload: true })).toBe(true)
    expect(isFromUpload({ fromUpload: 'yes' })).toBe(false)
    expect(isFromUpload(null)).toBe(false)
  })
})
