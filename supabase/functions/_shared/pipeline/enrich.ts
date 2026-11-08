import { calculateCo2e } from '../emissions/calculate.ts'
import { normalizeProductName } from '../emissions/normalize-name.ts'
import type { EmissionUnit } from '../emissions/types.ts'
import { normalizeQuantity, parsePackSize } from '../emissions/units.ts'
import type { ExtractedItem } from './schema.ts'

export type CategoryRef = {
  id: string
  slug: string
  unit: EmissionUnit
  co2e_per_unit: number
}

export type MappingRef = {
  normalized_name: string
  category_id: string
  /** null = global mapping */
  user_id: string | null
  /** Learned amount for this product (both or neither). */
  quantity?: number | null
  unit?: EmissionUnit | null
}

export type QuantitySource = 'receipt' | 'learned' | 'estimated' | 'user'

export type LineItemDraft = {
  raw_text: string
  normalized_name: string | null
  quantity: number | null
  unit: EmissionUnit | null
  quantity_source: QuantitySource | null
  price: number | null
  category_id: string | null
  confidence: number
  co2e_kg: number | null
}

/** Confidence for categories that come from a learned mapping (user or global). */
export const MAPPING_CONFIDENCE = 1

/** Deposit and empties are money, not products – dropped even if the model keeps them. */
const DEPOSIT = /\b(pfand|leergut|mehrweg\s*pfand|einweg\s*pfand)/i

type Amount = { quantity: number; unit: EmissionUnit; source: QuantitySource }

/**
 * Where the amount comes from, in this order:
 *  1. printed on the receipt (explicit quantity, or pack size in the name;
 *     "2 x Milch 1L" = 2 pieces with a pack size → 2 l)
 *  2. learned from the user's earlier correction of this product
 *  3. the model's estimate of a typical pack size
 */
export function resolveAmount(
  item: ExtractedItem,
  learned?: { quantity: number; unit: EmissionUnit } | null,
): Amount | null {
  const explicit =
    item.quantity !== null && item.unit !== null
      ? normalizeQuantity(item.quantity, item.unit)
      : null
  const pack = parsePackSize(item.raw_text)

  if (explicit && explicit.unit !== 'piece') return { ...explicit, source: 'receipt' }
  if (pack) {
    const count = explicit?.unit === 'piece' ? explicit.quantity : 1
    return { quantity: pack.quantity * count, unit: pack.unit, source: 'receipt' }
  }
  if (learned) {
    // "2 x Kinder Bueno" with a learned 43 g → 86 g
    const count = explicit?.unit === 'piece' ? explicit.quantity : 1
    return { quantity: learned.quantity * count, unit: learned.unit, source: 'learned' }
  }
  if (explicit) return { ...explicit, source: 'receipt' }
  const estimated =
    item.estimated_quantity !== null && item.estimated_unit !== null
      ? normalizeQuantity(item.estimated_quantity, item.estimated_unit)
      : null
  return estimated ? { ...estimated, source: 'estimated' } : null
}

/**
 * Turns validated model output into rows for `line_items`:
 * learned mappings beat the model (user mapping before global), amounts follow
 * `resolveAmount`, CO2e is calculated deterministically, discounts and deposits
 * are dropped.
 */
export function buildLineItems(input: {
  items: readonly ExtractedItem[]
  categories: readonly CategoryRef[]
  mappings: readonly MappingRef[]
  userId: string
}): LineItemDraft[] {
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]))
  const categoriesBySlug = new Map(input.categories.map((c) => [c.slug, c]))
  const userMappings = new Map<string, MappingRef>()
  const globalMappings = new Map<string, MappingRef>()
  for (const mapping of input.mappings) {
    if (mapping.user_id === input.userId) userMappings.set(mapping.normalized_name, mapping)
    else if (mapping.user_id === null) globalMappings.set(mapping.normalized_name, mapping)
  }

  return input.items
    .filter((item) => (item.price === null || item.price >= 0) && !DEPOSIT.test(item.raw_text))
    .map((item) => {
      const normalized = normalizeProductName(item.raw_text) || null
      const mapping =
        normalized === null
          ? undefined
          : (userMappings.get(normalized) ?? globalMappings.get(normalized))
      const category =
        (mapping === undefined ? undefined : categoriesById.get(mapping.category_id)) ??
        (item.category_slug === null ? undefined : categoriesBySlug.get(item.category_slug))

      const learned =
        mapping?.quantity != null && mapping.unit != null
          ? { quantity: Number(mapping.quantity), unit: mapping.unit }
          : null
      const amount = resolveAmount(item, learned)
      const result =
        category === undefined
          ? null
          : calculateCo2e(
              { quantity: amount?.quantity ?? null, unit: amount?.unit ?? null, price: item.price },
              { unit: category.unit, co2ePerUnit: Number(category.co2e_per_unit) },
            )

      return {
        raw_text: item.raw_text,
        normalized_name: normalized,
        quantity: amount?.quantity ?? null,
        unit: amount?.unit ?? null,
        quantity_source: amount?.source ?? null,
        price: item.price,
        category_id: category?.id ?? null,
        confidence:
          category === undefined ? 0 : mapping !== undefined ? MAPPING_CONFIDENCE : item.confidence,
        co2e_kg: result?.ok ? result.co2eKg : null,
      }
    })
}
