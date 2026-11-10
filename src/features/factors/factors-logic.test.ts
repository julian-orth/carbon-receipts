import { describe, expect, it } from 'vitest'
import { GROUP_LABEL, type EmissionCategory } from '@/features/categories/categories'
import { factorsToCsv, filterFactors, groupFactors, summarizeSources } from './factors-logic'

const IFEU = 'https://www.ifeu.de/x.pdf'
const BAFU = 'https://www.bafu.admin.ch/y.pdf'

const factor = (
  slug: string,
  label: string,
  group: string,
  overrides: Partial<EmissionCategory> = {},
): EmissionCategory => ({
  id: slug,
  slug,
  label,
  unit: 'kg',
  co2e_per_unit: 1.5,
  category_group: group,
  source: `ifeu 2020, ${label}`,
  source_url: IFEU,
  ...overrides,
})

const sample = [
  factor('beef', 'Rindfleisch', 'meat_fish'),
  factor('apples', 'Äpfel', 'fruit_vegetables'),
  factor('zucchini', 'Zucchini', 'fruit_vegetables'),
  factor('diesel', 'Diesel', 'fuel', { unit: 'l', source_url: BAFU, source: 'BAFU – Diesel' }),
]

describe('groupFactors', () => {
  it('keeps every factor exactly once', () => {
    const groups = groupFactors(sample)
    expect(groups.flatMap((g) => g.factors.map((f) => f.slug)).toSorted()).toEqual(
      sample.map((f) => f.slug).toSorted(),
    )
  })

  it('orders groups like GROUP_LABEL and factors alphabetically (Ä next to A)', () => {
    const groups = groupFactors(sample)
    expect(groups.map((g) => g.group)).toEqual(['fruit_vegetables', 'meat_fish', 'fuel'])
    expect(groups[0]?.factors.map((f) => f.label)).toEqual(['Äpfel', 'Zucchini'])
  })

  it('appends a group the UI does not know instead of dropping it', () => {
    const groups = groupFactors([...sample, factor('x', 'Neu', 'brand_new')])
    expect(groups.at(-1)).toMatchObject({ group: 'brand_new', label: 'brand_new' })
    expect(groups.flatMap((g) => g.factors)).toHaveLength(sample.length + 1)
  })

  it('has a label for every group of the migrated data', () => {
    const migrated = [
      'fruit_vegetables',
      'dairy_eggs',
      'meat_fish',
      'plant_protein',
      'staples',
      'fats_sweets',
      'beverages',
      'ready_meals',
      'pet',
      'fuel',
      'other',
    ]
    expect(Object.keys(GROUP_LABEL).toSorted()).toEqual(migrated.toSorted())
  })

  it('returns no groups for no factors', () => {
    expect(groupFactors([])).toEqual([])
  })
})

describe('filterFactors', () => {
  it('matches name and source, case-insensitively', () => {
    expect(filterFactors(sample, 'RIND').map((f) => f.slug)).toEqual(['beef'])
    expect(filterFactors(sample, 'bafu').map((f) => f.slug)).toEqual(['diesel'])
  })

  it('returns everything for an empty or blank query', () => {
    expect(filterFactors(sample, '')).toHaveLength(sample.length)
    expect(filterFactors(sample, '   ')).toHaveLength(sample.length)
  })

  it('returns nothing when nothing matches', () => {
    expect(filterFactors(sample, 'xyz')).toEqual([])
  })
})

describe('summarizeSources', () => {
  it('counts factors per source, largest first, with a readable name', () => {
    expect(summarizeSources(sample)).toEqual([
      expect.objectContaining({ url: IFEU, count: 3, name: expect.stringContaining('ifeu') }),
      expect.objectContaining({ url: BAFU, count: 1, name: expect.stringContaining('BAFU') }),
    ])
  })

  it('ignores factors without a link and falls back to the host', () => {
    const result = summarizeSources([
      factor('a', 'A', 'other', { source_url: null }),
      factor('b', 'B', 'other', { source_url: 'https://example.org/z' }),
    ])
    expect(result).toEqual([{ url: 'https://example.org/z', count: 1, name: 'example.org' }])
  })
})

describe('factorsToCsv', () => {
  it('has a header and one row per factor', () => {
    const lines = factorsToCsv(sample).trimEnd().split('\r\n')
    expect(lines[0]).toBe('slug,bezeichnung,gruppe,einheit,kg_co2e_je_einheit,quelle,quelle_url')
    expect(lines).toHaveLength(sample.length + 1)
  })

  it('quotes cells with commas and quotes, and keeps the decimal point', () => {
    const csv = factorsToCsv([
      factor('q', 'Käse, "würzig"', 'dairy_eggs', { co2e_per_unit: 5.7, source_url: null }),
    ])
    expect(csv).toContain(
      'q,"Käse, ""würzig""",Milchprodukte & Eier,kg,5.7,"ifeu 2020, Käse, ""würzig""",\r\n',
    )
  })
})
