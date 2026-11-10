import { describe, expect, it } from 'vitest'
import { ACCURACY, type AccuracyReport, formatAccuracy, hasMeasurements } from './accuracy'

describe('formatAccuracy', () => {
  it.each([
    [0.92, '92 %'],
    [1, '100 %'],
    [0, '0 %'],
    [0.875, '88 %'],
  ])('%s → %s', (value, expected) => {
    // The German format puts a no-break space before the percent sign.
    expect(formatAccuracy(value)?.replace(/\s/g, ' ')).toBe(expected)
  })

  it.each([null, Number.NaN, -0.1, 1.2, Number.POSITIVE_INFINITY])('%s → no value', (value) => {
    expect(formatAccuracy(value)).toBeNull()
  })
})

const report = (values: (number | null)[]): AccuracyReport => ({
  receipts: 12,
  measuredOn: '2026-12-01',
  metrics: values.map((value, i) => ({
    id: (['items', 'category', 'quantity', 'total'] as const)[i] ?? 'items',
    label: String(i),
    description: '',
    value,
  })),
})

describe('hasMeasurements', () => {
  it('is false while nothing is measured', () => {
    expect(hasMeasurements(report([null, null]))).toBe(false)
    expect(hasMeasurements(report([2, -1]))).toBe(false)
  })

  it('is true with one valid value', () => {
    expect(hasMeasurements(report([null, 0.9]))).toBe(true)
  })
})

describe('the shipped placeholder', () => {
  it('has the four metrics and makes no claim yet', () => {
    expect(ACCURACY.metrics.map((metric) => metric.id)).toEqual([
      'items',
      'category',
      'quantity',
      'total',
    ])
    expect(hasMeasurements(ACCURACY)).toBe(false)
  })
})
