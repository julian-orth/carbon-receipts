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
}

export type LineItemDraft = {
  raw_text: string
  normalized_name: string | null
  quantity: number | null
  unit: EmissionUnit | null
  price: number | null
  category_id: string | null
  confidence: number
  co2e_kg: number | null
}

/** Confidence for categories that come from a learned mapping (user or global). */
export const MAPPING_CONFIDENCE = 1

/**
 * Resolves the amount: explicit quantity + unit from the model; otherwise the pack
 * size in the name ("Milch 1L"); "2 x Milch 1L" (2 pieces with a pack size) → 2 l.
 */
export function resolveAmount(
  item: ExtractedItem,
): { quantity: number; unit: EmissionUnit } | null {
  const explicit =
    item.quantity !== null && item.unit !== null
      ? normalizeQuantity(item.quantity, item.unit)
      : null
  const pack = parsePackSize(item.raw_text)

  if (explicit && explicit.unit !== 'piece') return explicit
  if (pack) {
    const count = explicit?.unit === 'piece' ? explicit.quantity : 1
    return { quantity: pack.quantity * count, unit: pack.unit }
  }
  return explicit
}

/**
 * Turns validated model output into rows for `line_items`:
 * learned mappings beat the model's suggestion (user mapping before global),
 * CO2e is calculated deterministically, discounts/deposits are dropped.
 */
export function buildLineItems(input: {
  items: readonly ExtractedItem[]
  categories: readonly CategoryRef[]
  mappings: readonly MappingRef[]
  userId: string
}): LineItemDraft[] {
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]))
  const categoriesBySlug = new Map(input.categories.map((c) => [c.slug, c]))
  const userMappings = new Map<string, string>()
  const globalMappings = new Map<string, string>()
  for (const mapping of input.mappings) {
    if (mapping.user_id === input.userId)
      userMappings.set(mapping.normalized_name, mapping.category_id)
    else if (mapping.user_id === null)
      globalMappings.set(mapping.normalized_name, mapping.category_id)
  }

  return input.items
    .filter((item) => item.price === null || item.price >= 0)
    .map((item) => {
      const normalized = normalizeProductName(item.raw_text) || null
      const mappedId =
        normalized === null
          ? undefined
          : (userMappings.get(normalized) ?? globalMappings.get(normalized))
      const category =
        (mappedId === undefined ? undefined : categoriesById.get(mappedId)) ??
        (item.category_slug === null ? undefined : categoriesBySlug.get(item.category_slug))

      const amount = resolveAmount(item)
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
        price: item.price,
        category_id: category?.id ?? null,
        confidence:
          category === undefined
            ? 0
            : mappedId !== undefined
              ? MAPPING_CONFIDENCE
              : item.confidence,
        co2e_kg: result?.ok ? result.co2eKg : null,
      }
    })
}
