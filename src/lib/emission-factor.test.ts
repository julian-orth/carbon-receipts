import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Enums } from '@/types/db-helpers'
import { toEmissionFactor } from './emission-factor'
import type { EmissionUnit } from './emissions/types.ts'

describe('emission domain ↔ database contract', () => {
  it('EmissionUnit matches the emission_unit enum exactly', () => {
    expectTypeOf<EmissionUnit>().toEqualTypeOf<Enums<'emission_unit'>>()
  })

  it('maps a category row to a factor', () => {
    expect(toEmissionFactor({ unit: 'kg', co2e_per_unit: 13.6 })).toEqual({
      unit: 'kg',
      co2ePerUnit: 13.6,
    })
  })
})
