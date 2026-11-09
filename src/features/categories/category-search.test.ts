import { describe, expect, it } from 'vitest'
import { normalize, searchCategories, suggestCategories } from './category-search'
import { formatFactor, intensity } from './category-visuals'

const category = (slug: string, label: string, group = 'other') => ({
  id: slug,
  slug,
  label,
  category_group: group,
})

const categories = [
  category('coffee', 'Kaffee', 'beverages'),
  category('cheese', 'Käse', 'dairy_eggs'),
  category('cream-cheese', 'Frischkäse', 'dairy_eggs'),
  category('oat-drink', 'Haferdrink', 'plant_protein'),
  category('oats', 'Haferflocken & Müsli', 'staples'),
  category('soft-drinks', 'Limonade & Softdrinks', 'beverages'),
  category('tomatoes', 'Tomaten', 'fruit_vegetables'),
  category('tomato-products', 'Passierte Tomaten', 'fruit_vegetables'),
  category('ground-beef', 'Rinderhackfleisch', 'meat_fish'),
  category('beef', 'Rindfleisch', 'meat_fish'),
]
const ids = (list: readonly { id: string }[]) => list.map((c) => c.id)

describe('normalize', () => {
  it('ignores case, umlauts and ß', () => {
    expect(normalize('Käse')).toBe('kase')
    expect(normalize('Weißwein')).toBe('weisswein')
  })
})

describe('searchCategories', () => {
  it('ranks an exact umlaut prefix before its plain form', () => {
    expect(ids(searchCategories(categories, 'kä')).slice(0, 2)).toEqual(['cheese', 'coffee'])
  })

  it('finds word prefixes and keywords that are not in the label', () => {
    expect(ids(searchCategories(categories, 'drink'))).toEqual(['oat-drink', 'soft-drinks'])
    expect(ids(searchCategories(categories, 'gouda'))).toEqual(['cheese'])
    expect(ids(searchCategories(categories, 'cola'))).toEqual(['soft-drinks'])
  })

  it('returns everything for an empty query', () => {
    expect(searchCategories(categories, '  ')).toHaveLength(categories.length)
  })
})

describe('suggestCategories', () => {
  it('puts the current category first, then matches from the receipt text', () => {
    expect(ids(suggestCategories(categories, 'Bergkäse am Stück', 'coffee'))).toEqual([
      'coffee',
      'cheese',
    ])
  })

  it('matches compound words at their start or end, not anywhere inside', () => {
    // "tomaten" contains the soft-drink keyword "mate" – no match.
    expect(ids(suggestCategories(categories, 'Bio Tomaten', null))).toEqual([
      'tomatoes',
      'tomato-products',
    ])
    expect(ids(suggestCategories(categories, 'Barista Hafer 1L', null))).toEqual([
      'oat-drink',
      'oats',
    ])
    expect(ids(suggestCategories(categories, 'Rinderhack 500g', null))).toContain('ground-beef')
  })

  it('suggests nothing for unrelated text', () => {
    expect(suggestCategories(categories, 'Spülmittel Zitrone', null)).toEqual([])
  })
})

describe('intensity', () => {
  it('maps kg/litre factors to five levels and skips per-piece factors', () => {
    expect(intensity({ unit: 'kg', co2e_per_unit: 0.2 })?.level).toBe(1)
    expect(intensity({ unit: 'l', co2e_per_unit: 1.4 })?.level).toBe(2)
    expect(intensity({ unit: 'kg', co2e_per_unit: 5.7 })).toEqual({ level: 4, label: 'hoch' })
    expect(intensity({ unit: 'kg', co2e_per_unit: 13.6 })?.level).toBe(5)
    expect(intensity({ unit: 'piece', co2e_per_unit: 0.18 })).toBeNull()
  })

  it('formats the factor with its unit', () => {
    expect(formatFactor({ unit: 'kg', co2e_per_unit: 5.7 })).toBe('5,7 kg CO₂e/kg')
    expect(formatFactor({ unit: 'piece', co2e_per_unit: 1.6 })).toBe('1,6 kg CO₂e/Stk.')
  })
})
