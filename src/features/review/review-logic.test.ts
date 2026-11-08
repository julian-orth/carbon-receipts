import { describe, expect, it } from 'vitest'
import type { EmissionCategory } from '@/features/categories'
import {
  attentionReasons,
  computeCo2e,
  formatQuantityInput,
  learnedUpdate,
  type LineItem,
  parseQuantityInput,
} from './review-logic'

const beef: EmissionCategory = {
  id: 'beef',
  slug: 'ground-beef',
  label: 'Rinderhackfleisch',
  unit: 'kg',
  co2e_per_unit: 9.2,
  category_group: 'meat_fish',
  source: 'ifeu',
  source_url: 'https://example.com',
}
const milk: EmissionCategory = {
  ...beef,
  id: 'milk',
  slug: 'milk',
  label: 'Milch',
  unit: 'l',
  co2e_per_unit: 1.4,
}

function lineItem(overrides: Partial<LineItem>): LineItem {
  return {
    id: crypto.randomUUID(),
    receipt_id: 'r',
    user_id: 'u',
    raw_text: 'X',
    normalized_name: 'x',
    quantity: 1,
    unit: 'kg',
    price: 1,
    category_id: 'beef',
    confidence: 0.9,
    reviewed: false,
    quantity_source: null,
    co2e_kg: 9.2,
    created_at: '2026-11-07T10:00:00Z',
    updated_at: '2026-11-07T10:00:00Z',
    ...overrides,
  }
}

describe('computeCo2e', () => {
  it('calculates like the pipeline', () => {
    expect(
      computeCo2e({ categoryId: 'beef', quantity: 0.5, unit: 'kg', price: null }, beef),
    ).toEqual({
      ok: true,
      co2eKg: 4.6,
      note: null,
    })
  })

  it('notes the kg/l assumption', () => {
    expect(
      computeCo2e({ categoryId: 'milk', quantity: 1, unit: 'kg', price: null }, milk),
    ).toMatchObject({
      ok: true,
      note: 'kg und Liter gleichgesetzt',
    })
  })

  it.each([
    [{ categoryId: 'beef', quantity: null, unit: null, price: null }, beef, 'Menge fehlt'],
    [
      { categoryId: 'beef', quantity: 2, unit: 'piece' as const, price: null },
      beef,
      'Faktor gilt pro kg – bitte Menge in kg angeben',
    ],
    [
      { categoryId: null, quantity: 1, unit: 'kg' as const, price: null },
      undefined,
      'Keine Kategorie',
    ],
  ])('explains failures (%#)', (draft, category, message) => {
    expect(computeCo2e(draft, category)).toEqual({ ok: false, message })
  })
})

describe('attentionReasons', () => {
  it('is empty for confident, calculated items', () => {
    expect(attentionReasons(lineItem({}))).toEqual([])
  })

  it('flags missing category, low confidence and missing CO2e', () => {
    expect(attentionReasons(lineItem({ category_id: null, co2e_kg: null }))).toEqual([
      'no_category',
      'no_co2e',
    ])
    expect(attentionReasons(lineItem({ confidence: 0.5 }))).toEqual(['low_confidence'])
  })

  it('flags estimated amounts', () => {
    expect(attentionReasons(lineItem({ quantity_source: 'estimated' }))).toEqual([
      'estimated_quantity',
    ])
  })

  it('never flags reviewed items', () => {
    expect(
      attentionReasons(lineItem({ reviewed: true, category_id: null, co2e_kg: null })),
    ).toEqual([])
  })
})

describe('quantity input', () => {
  it.each([
    ['0,5', 0.5],
    ['1.25', 1.25],
    ['', null],
    ['  ', null],
    ['abc', undefined],
    ['0', undefined],
  ])('parses %j → %j', (input, expected) => {
    expect(parseQuantityInput(input)).toBe(expected)
  })

  it('formats with a German decimal comma', () => {
    expect(formatQuantityInput(0.5)).toBe('0,5')
    expect(formatQuantityInput(null)).toBe('')
  })
})

describe('learnedUpdate', () => {
  const cheese: EmissionCategory = {
    ...beef,
    id: 'cheese',
    slug: 'cheese',
    label: 'Käse',
    co2e_per_unit: 5.7,
  }
  const learned = { categoryId: 'cheese', quantity: 0.15, unit: 'kg' as const }

  it('applies category and amount to an item without a printed amount', () => {
    expect(
      learnedUpdate(
        {
          category_id: 'beef',
          quantity: 0.4,
          unit: 'kg',
          quantity_source: 'estimated',
          price: 2.29,
        },
        learned,
        cheese,
      ),
    ).toEqual({
      category_id: 'cheese',
      quantity: 0.15,
      unit: 'kg',
      quantity_source: 'learned',
      co2e_kg: 0.855,
    })
  })

  it('keeps an amount printed on the receipt', () => {
    expect(
      learnedUpdate(
        { category_id: null, quantity: 0.3, unit: 'kg', quantity_source: 'receipt', price: 3 },
        learned,
        cheese,
      ),
    ).toEqual({
      category_id: 'cheese',
      quantity: 0.3,
      unit: 'kg',
      quantity_source: 'receipt',
      co2e_kg: 1.71,
    })
  })

  it('only changes the category when nothing was learned about the amount', () => {
    expect(
      learnedUpdate(
        { category_id: null, quantity: null, unit: null, quantity_source: null, price: 1 },
        { categoryId: 'cheese', quantity: null, unit: null },
        cheese,
      ),
    ).toEqual({
      category_id: 'cheese',
      quantity: null,
      unit: null,
      quantity_source: null,
      co2e_kg: null,
    })
  })

  it('returns null when the item already matches', () => {
    expect(
      learnedUpdate(
        { category_id: 'cheese', quantity: 0.15, unit: 'kg', quantity_source: 'learned', price: 1 },
        learned,
        cheese,
      ),
    ).toBeNull()
  })
})
