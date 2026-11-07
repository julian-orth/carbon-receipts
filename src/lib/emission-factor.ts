import type { Tables } from '@/types/db-helpers'
import type { EmissionFactor } from '@shared/emissions/types.ts'

/** Adapter: DB row → pure domain type used by `calculateCo2e`. */
export function toEmissionFactor(
  category: Pick<Tables<'emission_categories'>, 'unit' | 'co2e_per_unit'>,
): EmissionFactor {
  return { unit: category.unit, co2ePerUnit: Number(category.co2e_per_unit) }
}
