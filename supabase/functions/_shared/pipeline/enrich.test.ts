import { describe, expect, it } from 'vitest'
import { buildLineItems, type CategoryRef, resolveAmount } from './enrich.ts'
import type { ExtractedItem } from './schema.ts'

const categories: CategoryRef[] = [
  { id: 'c-beef', slug: 'ground-beef', unit: 'kg', co2e_per_unit: 9.2 },
  { id: 'c-milk', slug: 'milk', unit: 'l', co2e_per_unit: 1.4 },
  { id: 'c-oat', slug: 'oat-drink', unit: 'l', co2e_per_unit: 0.3 },
  { id: 'c-eggs', slug: 'eggs', unit: 'piece', co2e_per_unit: 0.18 },
]
const userId = 'user-1'

function item(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    raw_text: 'X',
    quantity: null,
    unit: null,
    estimated_quantity: null,
    estimated_unit: null,
    price: 1,
    category_slug: null,
    confidence: 0.8,
    ...overrides,
  }
}

describe('resolveAmount', () => {
  it.each([
    [
      { raw_text: 'Rinderhack', quantity: 500, unit: 'g' },
      { quantity: 0.5, unit: 'kg', source: 'receipt' },
    ],
    [{ raw_text: 'Milch 1L' }, { quantity: 1, unit: 'l', source: 'receipt' }],
    [
      { raw_text: 'Milch 1L', quantity: 2, unit: 'stk' },
      { quantity: 2, unit: 'l', source: 'receipt' },
    ],
    [
      { raw_text: 'Eier', quantity: 10, unit: 'stk' },
      { quantity: 10, unit: 'piece', source: 'receipt' },
    ],
    [
      { raw_text: 'Kinder Bueno', estimated_quantity: 43, estimated_unit: 'g' },
      { quantity: 0.043, unit: 'kg', source: 'estimated' },
    ],
    [{ raw_text: 'Gouda' }, null],
  ])('%j → %j', (overrides, expected) => {
    expect(resolveAmount(item(overrides))).toEqual(expected)
  })

  it('prefers a learned amount over the estimate, and the receipt over both', () => {
    const learned = { quantity: 0.043, unit: 'kg' as const }
    expect(
      resolveAmount(
        item({ raw_text: 'Bueno', estimated_quantity: 100, estimated_unit: 'g' }),
        learned,
      ),
    ).toEqual({
      quantity: 0.043,
      unit: 'kg',
      source: 'learned',
    })
    expect(resolveAmount(item({ raw_text: 'Bueno', quantity: 2, unit: 'stk' }), learned)).toEqual({
      quantity: 0.086,
      unit: 'kg',
      source: 'learned',
    })
    expect(
      resolveAmount(item({ raw_text: 'Bananen', quantity: 1.186, unit: 'kg' }), learned),
    ).toEqual({
      quantity: 1.186,
      unit: 'kg',
      source: 'receipt',
    })
  })
})

describe('buildLineItems', () => {
  it('uses the model category and calculates CO2e', () => {
    const [row] = buildLineItems({
      items: [
        item({
          raw_text: 'Rinderhack 500g',
          category_slug: 'ground-beef',
          price: 5.49,
          confidence: 0.95,
        }),
      ],
      categories,
      mappings: [],
      userId,
    })
    expect(row).toEqual({
      raw_text: 'Rinderhack 500g',
      normalized_name: 'rinderhack',
      quantity: 0.5,
      unit: 'kg',
      quantity_source: 'receipt',
      price: 5.49,
      category_id: 'c-beef',
      confidence: 0.95,
      co2e_kg: 4.6,
    })
  })

  it('prefers the user mapping over a global mapping over the model', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Barista Drink 1L', category_slug: 'milk', confidence: 0.4 })],
      categories,
      mappings: [
        { normalized_name: 'barista drink', category_id: 'c-milk', user_id: null },
        { normalized_name: 'barista drink', category_id: 'c-oat', user_id: userId },
        { normalized_name: 'barista drink', category_id: 'c-beef', user_id: 'someone-else' },
      ],
      userId,
    })
    expect(rows[0]).toMatchObject({ category_id: 'c-oat', confidence: 1, co2e_kg: 0.3 })
  })

  it('falls back to a global mapping', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Barista Drink 1L' })],
      categories,
      mappings: [{ normalized_name: 'barista drink', category_id: 'c-oat', user_id: null }],
      userId,
    })
    expect(rows[0]).toMatchObject({ category_id: 'c-oat', confidence: 1 })
  })

  it('keeps items without quantity but leaves CO2e empty for review', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Gouda Scheiben', category_slug: 'ground-beef' })],
      categories,
      mappings: [],
      userId,
    })
    expect(rows[0]).toMatchObject({ category_id: 'c-beef', quantity: null, co2e_kg: null })
  })

  it('sets confidence 0 for unknown categories', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Batterien', category_slug: 'electronics', confidence: 0.9 })],
      categories,
      mappings: [],
      userId,
    })
    expect(rows[0]).toMatchObject({ category_id: null, confidence: 0, co2e_kg: null })
  })

  it('uses the learned amount from a mapping', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Barista Drink', estimated_quantity: 750, estimated_unit: 'ml' })],
      categories,
      mappings: [
        {
          normalized_name: 'barista drink',
          category_id: 'c-oat',
          user_id: userId,
          quantity: 1,
          unit: 'l',
        },
      ],
      userId,
    })
    expect(rows[0]).toMatchObject({
      quantity: 1,
      unit: 'l',
      quantity_source: 'learned',
      co2e_kg: 0.3,
    })
  })

  it('calculates with an estimated amount but marks it as such', () => {
    const rows = buildLineItems({
      items: [
        item({
          raw_text: 'Haferdrink',
          category_slug: 'oat-drink',
          estimated_quantity: 1,
          estimated_unit: 'l',
        }),
      ],
      categories,
      mappings: [],
      userId,
    })
    expect(rows[0]).toMatchObject({
      quantity: 1,
      unit: 'l',
      quantity_source: 'estimated',
      co2e_kg: 0.3,
    })
  })

  it.each(['Pfandartikel', 'PFAND 0,25 EUR', 'Leergut', 'Einweg Pfand'])(
    'drops deposit lines (%s)',
    (raw) => {
      expect(
        buildLineItems({
          items: [item({ raw_text: raw, price: 0.25 })],
          categories,
          mappings: [],
          userId,
        }),
      ).toEqual([])
    },
  )

  it('drops discounts and deposit returns', () => {
    const rows = buildLineItems({
      items: [item({ raw_text: 'Milch 1L' }), item({ raw_text: 'Rabatt', price: -0.25 })],
      categories,
      mappings: [],
      userId,
    })
    expect(rows.map((r) => r.raw_text)).toEqual(['Milch 1L'])
  })
})
