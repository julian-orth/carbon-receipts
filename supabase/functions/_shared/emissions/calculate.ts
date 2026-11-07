import { roundCo2e } from './round.ts'
import type { EmissionFactor, LineItemAmount } from './types.ts'

export type CalculationFailure = 'missing_quantity' | 'missing_price' | 'unit_mismatch'

export type CalculationResult =
  | {
      ok: true
      co2eKg: number
      basis: 'quantity' | 'spend'
      /** Set when kg and l were treated as interchangeable (density ≈ 1). */
      assumption?: 'density_1'
    }
  | { ok: false; reason: CalculationFailure }

const isPositive = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0

/**
 * The single place where CO2e is computed: `amount × factor`.
 *
 * - spend-based factors (`eur`) use the line price
 * - quantity-based factors need a matching unit; kg ↔ l is accepted with a
 *   density of 1 (all liquid factors are food/beverages close to water)
 * - everything else fails explicitly, so the item ends up in the review screen
 *   instead of getting a silently wrong number
 */
export function calculateCo2e(item: LineItemAmount, factor: EmissionFactor): CalculationResult {
  if (factor.unit === 'eur') {
    if (!isPositive(item.price)) return { ok: false, reason: 'missing_price' }
    return { ok: true, co2eKg: roundCo2e(item.price * factor.co2ePerUnit), basis: 'spend' }
  }

  if (!isPositive(item.quantity) || item.unit === null) {
    return { ok: false, reason: 'missing_quantity' }
  }

  if (item.unit === factor.unit) {
    return {
      ok: true,
      co2eKg: roundCo2e(item.quantity * factor.co2ePerUnit),
      basis: 'quantity',
    }
  }

  const massVolume = new Set([item.unit, factor.unit])
  if (massVolume.size === 2 && massVolume.has('kg') && massVolume.has('l')) {
    return {
      ok: true,
      co2eKg: roundCo2e(item.quantity * factor.co2ePerUnit),
      basis: 'quantity',
      assumption: 'density_1',
    }
  }

  return { ok: false, reason: 'unit_mismatch' }
}

/** Sum of known values; items without a value are ignored. */
export function sumCo2e(values: ReadonlyArray<number | null | undefined>): number {
  return roundCo2e(values.reduce<number>((sum, value) => sum + (value ?? 0), 0))
}
