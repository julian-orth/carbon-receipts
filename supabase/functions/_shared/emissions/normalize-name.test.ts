import { describe, expect, it } from 'vitest'
import { normalizeProductName } from './normalize-name.ts'

describe('normalizeProductName', () => {
  it.each([
    ['BIO VOLLMILCH 3,8% 1L', 'bio vollmilch'],
    ['Bio Vollmilch 3.8 % 1 l', 'bio vollmilch'],
    ['  Rinderhack   500g  ', 'rinderhack'],
    ['Mineralwasser 6x0,7l', 'mineralwasser'],
    ['GOUDA JUNG 400 GR 2,99', 'gouda jung'],
    ['Äpfel Elstar lose', 'äpfel elstar lose'],
    ['Weißkohl', 'weißkohl'],
    ['Hafer-Drink (Barista)', 'hafer drink barista'],
    ['Eier Freiland 10 Stk', 'eier freiland'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeProductName(input)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalizeProductName('BIO VOLLMILCH 3,8% 1L')
    expect(normalizeProductName(once)).toBe(once)
  })

  it('satisfies the database check lower(trim(x)) = x', () => {
    for (const input of ['  ABC  ', 'Ä Ö Ü', 'x 1kg y']) {
      const result = normalizeProductName(input)
      expect(result).toBe(result.trim().toLowerCase())
    }
  })

  it('returns an empty string for lines without letters', () => {
    expect(normalizeProductName('12,99 €')).toBe('')
  })
})
