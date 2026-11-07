import { describe, expect, it } from 'vitest'
import { calculateCo2e, sumCo2e } from './calculate.ts'
import type { EmissionFactor } from './types.ts'

const beef: EmissionFactor = { unit: 'kg', co2ePerUnit: 13.6 }
const milk: EmissionFactor = { unit: 'l', co2ePerUnit: 1.4 }
const eggs: EmissionFactor = { unit: 'piece', co2ePerUnit: 0.18 }
const spend: EmissionFactor = { unit: 'eur', co2ePerUnit: 0.5 }

function beefCo2e(quantity: number): number {
  const result = calculateCo2e({ quantity, unit: 'kg', price: null }, beef)
  return result.ok ? result.co2eKg : Number.NaN
}

describe('calculateCo2e', () => {
  it('multiplies quantity by the factor', () => {
    expect(calculateCo2e({ quantity: 0.5, unit: 'kg', price: 6.99 }, beef)).toEqual({
      ok: true,
      co2eKg: 6.8,
      basis: 'quantity',
    })
  })

  it('works per piece', () => {
    expect(calculateCo2e({ quantity: 10, unit: 'piece', price: null }, eggs)).toMatchObject({
      ok: true,
      co2eKg: 1.8,
    })
  })

  it('rounds to 4 decimals without floating point noise', () => {
    // 0.1 * 3 = 0.30000000000000004 in IEEE 754
    const result = calculateCo2e(
      { quantity: 0.1, unit: 'kg', price: null },
      { unit: 'kg', co2ePerUnit: 3 },
    )
    expect(result).toMatchObject({ ok: true, co2eKg: 0.3 })
  })

  it('treats kg and l as interchangeable and says so', () => {
    expect(calculateCo2e({ quantity: 1, unit: 'kg', price: null }, milk)).toEqual({
      ok: true,
      co2eKg: 1.4,
      basis: 'quantity',
      assumption: 'density_1',
    })
  })

  it('uses the price for spend-based factors', () => {
    expect(calculateCo2e({ quantity: null, unit: null, price: 20 }, spend)).toEqual({
      ok: true,
      co2eKg: 10,
      basis: 'spend',
    })
  })

  it.each([
    [{ quantity: null, unit: 'kg' as const, price: 5 }],
    [{ quantity: 0, unit: 'kg' as const, price: 5 }],
    [{ quantity: -1, unit: 'kg' as const, price: 5 }],
    [{ quantity: Number.NaN, unit: 'kg' as const, price: 5 }],
    [{ quantity: 1, unit: null, price: 5 }],
  ])('fails with missing_quantity for %o', (item) => {
    expect(calculateCo2e(item, beef)).toEqual({ ok: false, reason: 'missing_quantity' })
  })

  it('fails with missing_price for spend-based factors without a price', () => {
    expect(calculateCo2e({ quantity: 1, unit: 'kg', price: null }, spend)).toEqual({
      ok: false,
      reason: 'missing_price',
    })
  })

  it('refuses to guess between pieces and mass', () => {
    expect(calculateCo2e({ quantity: 2, unit: 'piece', price: null }, beef)).toEqual({
      ok: false,
      reason: 'unit_mismatch',
    })
  })

  it.each([0.125, 0.5, 1, 2.75, 10])('is linear in the quantity (%d kg)', (quantity) => {
    expect(beefCo2e(quantity * 2)).toBeCloseTo(beefCo2e(quantity) * 2, 3)
  })
})

describe('sumCo2e', () => {
  it('ignores missing values and rounds', () => {
    expect(sumCo2e([0.1, 0.2, null, undefined, 1.0005])).toBe(1.3005)
  })

  it('returns 0 for an empty list', () => {
    expect(sumCo2e([])).toBe(0)
  })
})
