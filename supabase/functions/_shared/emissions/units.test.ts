import { describe, expect, it } from 'vitest'
import { normalizeQuantity, parseDecimal, parsePackSize } from './units.ts'

describe('parseDecimal', () => {
  it.each([
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['1.000,5', 1000.5],
    ['0,33', 0.33],
    ['42', 42],
  ])('%s → %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(['', 'abc', '1,2,3', '1.2.3,4.5'])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe('normalizeQuantity', () => {
  it.each([
    [500, 'g', 0.5, 'kg'],
    [1.5, 'KG', 1.5, 'kg'],
    [330, 'ml', 0.33, 'l'],
    [75, 'cl', 0.75, 'l'],
    [6, 'Stk.', 6, 'piece'],
    [12.5, '€', 12.5, 'eur'],
  ])('%d %s → %d %s', (quantity, unit, expectedQuantity, expectedUnit) => {
    const result = normalizeQuantity(quantity, unit)
    expect(result?.unit).toBe(expectedUnit)
    expect(result?.quantity).toBeCloseTo(expectedQuantity, 10)
  })

  it('rejects unknown units and non-positive quantities', () => {
    expect(normalizeQuantity(1, 'bushel')).toBeNull()
    expect(normalizeQuantity(0, 'kg')).toBeNull()
    expect(normalizeQuantity(-2, 'kg')).toBeNull()
  })
})

describe('parsePackSize', () => {
  it.each([
    ['Rinderhack 500g', 0.5, 'kg'],
    ['BIO VOLLMILCH 3,8% 1L', 1, 'l'],
    ['Mineralwasser 6x0,7l', 4.2, 'l'],
    ['Cola 1,5 l', 1.5, 'l'],
    ['Gouda 400 gr', 0.4, 'kg'],
  ])('%s → %d %s', (text, quantity, unit) => {
    const result = parsePackSize(text)
    expect(result?.unit).toBe(unit)
    expect(result?.quantity).toBeCloseTo(quantity, 10)
  })

  it('ignores numbers that are not pack sizes', () => {
    expect(parsePackSize('Joghurt 3,5%')).toBeNull()
    expect(parsePackSize('Bananen')).toBeNull()
    expect(parsePackSize('Lindt 70 Gold')).toBeNull()
  })
})
