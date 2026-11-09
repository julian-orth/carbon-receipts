import { describe, expect, it } from 'vitest'
import type { LineItem } from '@/features/review/review-logic'
import { buildLog, summarize } from './progress'
import { ALL_DONE, displayTarget, formatClock, isFromUpload, serverStepIndex, STEP } from './steps'

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

describe('formatClock', () => {
  it('shows minutes, seconds and tenths', () => {
    expect(formatClock(0)).toBe('00:00.0')
    expect(formatClock(4_250)).toBe('00:04.2')
    expect(formatClock(75_900)).toBe('01:15.9')
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

describe('buildLog', () => {
  const base = {
    status: 'processing' as const,
    error: null,
    failedAt: null,
    fromUpload: true,
    summary: null,
  }

  it('makes a provider fallback visible', () => {
    const log = buildLog({
      ...base,
      visits: [
        { step: STEP.upload, at: 0 },
        { step: STEP.read, at: 700 },
      ],
      providers: [
        { name: 'gemini', at: 800 },
        { name: 'groq', at: 4_200 },
      ],
    })
    expect(log.map((entry) => entry.text)).toEqual([
      'Upload gestartet',
      'Foto liegt im privaten Speicher',
      'Anfrage an Gemini',
      'Gemini nicht verfügbar · Fallback auf Groq',
    ])
    expect(log.at(-1)?.tone).toBe('warn')
  })

  it('summarizes the result and ends with the failure reason when a run fails', () => {
    const summary = summarize([item(), item({ co2e_kg: null, quantity: null })])
    const done = buildLog({
      ...base,
      status: 'review',
      summary,
      providers: [],
      visits: [
        { step: STEP.read, at: 0 },
        { step: STEP.validate, at: 100 },
        { step: STEP.match, at: 200 },
        { step: STEP.calculate, at: 300 },
        { step: ALL_DONE, at: 400 },
      ],
    })
    expect(done.map((entry) => entry.text)).toContain('2 Positionen erkannt')
    expect(done.slice(-2).map((entry) => entry.text)).toEqual([
      'Summe: 1,71 kg CO₂e',
      '1 Position braucht deinen Blick',
    ])

    const failed = buildLog({
      ...base,
      status: 'failed',
      error: 'Die KI-Dienste sind gerade nicht erreichbar.',
      failedAt: 5_000,
      providers: [],
      visits: [{ step: STEP.read, at: 0 }],
    })
    expect(failed.at(-1)).toEqual({
      at: 5_000,
      text: 'Die KI-Dienste sind gerade nicht erreichbar.',
      tone: 'danger',
    })
  })
})

describe('isFromUpload', () => {
  it('only accepts the state set by the upload', () => {
    expect(isFromUpload({ fromUpload: true })).toBe(true)
    expect(isFromUpload({ fromUpload: 'yes' })).toBe(false)
    expect(isFromUpload(null)).toBe(false)
  })
})
