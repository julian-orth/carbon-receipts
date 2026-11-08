import { calculateCo2e, type CalculationFailure } from '@shared/emissions/calculate.ts'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import { parseDecimal } from '@shared/emissions/units.ts'
import type { EmissionCategory } from '@/features/categories'
import type { Tables } from '@/types/db-helpers'

export type LineItem = Tables<'line_items'>

/** Below this the model's category is shown as uncertain. */
export const CONFIDENCE_THRESHOLD = 0.7

export const UNIT_LABEL: Record<EmissionUnit, string> = {
  kg: 'kg',
  l: 'Liter',
  piece: 'Stück',
  eur: '€',
}

export type ItemDraft = {
  categoryId: string | null
  quantity: number | null
  unit: EmissionUnit | null
  price: number | null
}

export type Co2eOutcome =
  { ok: true; co2eKg: number; note: string | null } | { ok: false; message: string }

const FAILURE_MESSAGE: Record<CalculationFailure, (category: EmissionCategory) => string> = {
  missing_quantity: () => 'Menge fehlt',
  missing_price: () => 'Preis fehlt',
  unit_mismatch: (category) =>
    `Faktor gilt pro ${UNIT_LABEL[category.unit]} – bitte Menge in ${UNIT_LABEL[category.unit]} angeben`,
}

/** Same formula as the pipeline: the result shown is exactly what gets stored. */
export function computeCo2e(draft: ItemDraft, category: EmissionCategory | undefined): Co2eOutcome {
  if (!category) return { ok: false, message: 'Keine Kategorie' }
  const result = calculateCo2e(draft, {
    unit: category.unit,
    co2ePerUnit: Number(category.co2e_per_unit),
  })
  if (!result.ok) return { ok: false, message: FAILURE_MESSAGE[result.reason](category) }
  return {
    ok: true,
    co2eKg: result.co2eKg,
    note: result.assumption === 'density_1' ? 'kg und Liter gleichgesetzt' : null,
  }
}

export type AttentionReason = 'no_category' | 'low_confidence' | 'estimated_quantity' | 'no_co2e'

/** Why an unreviewed item should be looked at; empty when it looks fine. */
export function attentionReasons(item: LineItem): AttentionReason[] {
  if (item.reviewed) return []
  const reasons: AttentionReason[] = []
  if (item.category_id === null) reasons.push('no_category')
  else if ((item.confidence ?? 0) < CONFIDENCE_THRESHOLD) reasons.push('low_confidence')
  if (item.quantity_source === 'estimated') reasons.push('estimated_quantity')
  if (item.co2e_kg === null) reasons.push('no_co2e')
  return reasons
}

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  no_category: 'Kategorie fehlt',
  low_confidence: 'Kategorie unsicher',
  estimated_quantity: 'Menge geschätzt',
  no_co2e: 'Kein CO₂-Wert',
}

/** Parses the quantity input ("0,5", "1.25"); empty → null, invalid → undefined. */
export function parseQuantityInput(value: string): number | null | undefined {
  if (value.trim() === '') return null
  const parsed = parseDecimal(value)
  return parsed !== null && parsed > 0 ? parsed : undefined
}

export function formatQuantityInput(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',')
}

export type Learned = { categoryId: string; quantity: number | null; unit: EmissionUnit | null }

/**
 * What a correction means for another *open* item of the same product: the category
 * always follows; the amount only replaces amounts that did not come from the receipt.
 * Returns null when nothing would change.
 */
export function learnedUpdate(
  item: Pick<LineItem, 'category_id' | 'quantity' | 'unit' | 'quantity_source' | 'price'>,
  learned: Learned,
  category: EmissionCategory,
): Pick<LineItem, 'category_id' | 'quantity' | 'unit' | 'quantity_source' | 'co2e_kg'> | null {
  const takeAmount =
    learned.quantity !== null && learned.unit !== null && item.quantity_source !== 'receipt'
  const quantity = takeAmount ? learned.quantity : item.quantity
  const unit = takeAmount ? learned.unit : item.unit
  const quantitySource = takeAmount ? 'learned' : item.quantity_source
  const result = computeCo2e(
    { categoryId: learned.categoryId, quantity, unit, price: item.price },
    category,
  )
  const next = {
    category_id: learned.categoryId,
    quantity,
    unit,
    quantity_source: quantitySource,
    co2e_kg: result.ok ? result.co2eKg : null,
  }
  const unchanged =
    item.category_id === next.category_id &&
    item.quantity === next.quantity &&
    item.unit === next.unit &&
    item.quantity_source === next.quantity_source
  return unchanged ? null : next
}
