/**
 * Pure domain types. This folder has no imports outside itself (and uses `.ts`
 * extensions) so the edge function (Deno) can reuse it unchanged.
 */
export type EmissionUnit = 'kg' | 'l' | 'piece' | 'eur'

export type EmissionFactor = {
  /** kg CO2e per `unit` */
  co2ePerUnit: number
  unit: EmissionUnit
}

export type LineItemAmount = {
  quantity: number | null
  unit: EmissionUnit | null
  /** Total price of the line in EUR (needed for spend-based factors). */
  price: number | null
}
