import { describe, expect, it } from 'vitest'
import { parseReceiptExtraction } from './schema.ts'

describe('parseReceiptExtraction', () => {
  it('accepts well-formed output', () => {
    const result = parseReceiptExtraction({
      merchant: 'REWE',
      purchased_at: '2026-11-07',
      items: [
        {
          raw_text: 'Bananen',
          quantity: 1.2,
          unit: 'kg',
          price: 1.67,
          category_slug: 'bananas',
          confidence: 0.9,
        },
      ],
    })
    expect(result.items[0]).toEqual({
      raw_text: 'Bananen',
      quantity: 1.2,
      unit: 'kg',
      estimated_quantity: null,
      estimated_unit: null,
      price: 1.67,
      category_slug: 'bananas',
      confidence: 0.9,
    })
  })

  it('coerces German number strings and fills missing fields', () => {
    const result = parseReceiptExtraction({
      items: [{ raw_text: ' Milch 1L ', price: '1,39 €', quantity: '', confidence: '0,8' }],
    })
    expect(result).toEqual({
      merchant: null,
      purchased_at: null,
      items: [
        {
          raw_text: 'Milch 1L',
          estimated_quantity: null,
          estimated_unit: null,
          quantity: null,
          unit: null,
          price: 1.39,
          category_slug: null,
          confidence: 0.8,
        },
      ],
    })
  })

  it('keeps negative prices (discounts) as numbers', () => {
    const result = parseReceiptExtraction({
      items: [{ raw_text: 'Rabatt', price: '-0,50', confidence: 1 }],
    })
    expect(result.items[0]?.price).toBe(-0.5)
  })

  it('degrades unusable optional values instead of failing', () => {
    const result = parseReceiptExtraction({
      purchased_at: '07.11.2026',
      items: [{ raw_text: 'X', confidence: 7 }],
    })
    expect(result.purchased_at).toBeNull()
    expect(result.items[0]?.confidence).toBe(0)
  })

  it.each([
    [{}],
    [{ items: 'nope' }],
    [{ items: [{ raw_text: '' }] }],
    [{ items: [{ raw_text: 'A', price: 'zwölf' }] }],
    [null],
  ])('rejects %j', (raw) => {
    expect(() => parseReceiptExtraction(raw)).toThrow(/invalid|expected|too_small|Too small/i)
  })
})
