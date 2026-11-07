import { describe, expect, it } from 'vitest'
import { roundCo2e, roundTo } from './round.ts'

describe('roundTo', () => {
  it.each([
    [1.005, 2, 1.01],
    [0.30000000000000004, 4, 0.3],
    [6.80000001, 4, 6.8],
    [12.34565, 4, 12.3457],
  ])('roundTo(%d, %d) = %d', (value, decimals, expected) => {
    expect(roundTo(value, decimals)).toBe(expected)
  })

  it('handles very small and very large values', () => {
    expect(roundTo(1e-7, 4)).toBe(0)
    expect(roundTo(123456789.12345, 4)).toBe(123456789.1235)
  })

  it('roundCo2e uses 4 decimals', () => {
    expect(roundCo2e(1.23456789)).toBe(1.2346)
  })
})
