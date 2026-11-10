import { describe, expect, it } from 'vitest'
import { assessExtraction, collectNotes, isForeignCurrency } from './assess.ts'
import { parseReceiptExtraction } from './schema.ts'

const item = {
  raw_text: 'Milch',
  quantity: 1,
  unit: 'l',
  price: 1.2,
  category_slug: 'milk',
  confidence: 0.9,
}
const parse = (raw: Record<string, unknown>) => parseReceiptExtraction({ items: [], ...raw })

describe('assessExtraction', () => {
  it('rejects a photo of something else, even with items', () => {
    expect(assessExtraction(parse({ document_type: 'not_a_receipt', items: [item] }))).toBe(
      'not_a_receipt',
    )
  })

  it('explains an empty result by the reported issue', () => {
    expect(assessExtraction(parse({ issues: ['unreadable'] }))).toBe('unreadable')
    expect(assessExtraction(parse({ issues: ['cut_off'] }))).toBe('cut_off')
    expect(assessExtraction(parse({ issues: ['unreadable', 'cut_off'] }))).toBe('unreadable')
    expect(assessExtraction(parse({}))).toBe('no_items')
  })

  it('accepts a receipt with items, whatever issues were reported', () => {
    expect(assessExtraction(parse({ items: [item], issues: ['cut_off'] }))).toBeNull()
  })
})

describe('collectNotes', () => {
  it('passes the reported issues on', () => {
    const extraction = parse({ items: [item], issues: ['cut_off', 'multiple_receipts'] })
    expect(collectNotes(extraction, [{ category_id: 'x' }])).toEqual([
      'cut_off',
      'multiple_receipts',
    ])
  })

  it('notes a foreign currency but not EUR', () => {
    expect(collectNotes(parse({ items: [item], currency: 'chf' }), [{ category_id: 'x' }])).toEqual(
      ['foreign_currency'],
    )
    expect(collectNotes(parse({ items: [item], currency: 'EUR' }), [{ category_id: 'x' }])).toEqual(
      [],
    )
  })

  it('notes non-food receipts by what was stored, not only by what the model said', () => {
    const extraction = parse({ items: [item] })
    expect(collectNotes(extraction, [{ category_id: null }, { category_id: null }])).toEqual([
      'non_food_only',
    ])
    expect(collectNotes(extraction, [{ category_id: null }, { category_id: 'x' }])).toEqual([])
  })

  it('does not report non_food_only twice', () => {
    const extraction = parse({ items: [item], issues: ['non_food_only'] })
    expect(collectNotes(extraction, [{ category_id: null }])).toEqual(['non_food_only'])
  })
})

describe('isForeignCurrency', () => {
  it.each([
    [null, false],
    ['EUR', false],
    ['CHF', true],
    ['USD', true],
  ])('%s → %s', (currency, expected) => {
    expect(isForeignCurrency(currency)).toBe(expected)
  })
})

describe('schema: new fields', () => {
  it('defaults to a receipt without issues and drops unknown issues', () => {
    const result = parse({ issues: ['cut_off', 'nonsense', 3], currency: ' chf ' })
    expect(result.document_type).toBe('receipt')
    expect(result.issues).toEqual(['cut_off'])
    expect(result.currency).toBe('CHF')
  })

  it('survives garbage in the new fields', () => {
    const result = parse({ document_type: 42, issues: 'cut_off', currency: { a: 1 } })
    expect(result).toMatchObject({ document_type: 'receipt', issues: [], currency: null })
  })
})
