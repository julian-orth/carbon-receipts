import { describe, expect, it } from 'vitest'
import { formatCo2e } from './format-co2'

describe('formatCo2e', () => {
  it.each([
    [4.6, '4,6 kg CO₂e'],
    [12.3456, '12,35 kg CO₂e'],
    [0.72, '720 g CO₂e'],
    [0, '0 kg CO₂e'],
    [1234.5, '1.234,5 kg CO₂e'],
  ])('%d → %s', (kg, expected) => {
    expect(formatCo2e(kg)).toBe(expected)
  })
})
