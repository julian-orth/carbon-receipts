import type { EmissionUnit } from '@shared/emissions/types.ts'

const IFEU =
  'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf'

/** Either an existing emission category or a product with its own ifeu factor. */
export type AlternativeTarget =
  | { kind: 'category'; slug: string }
  | {
      kind: 'product'
      label: string
      unit: EmissionUnit
      co2ePerUnit: number
      source: string
      sourceUrl: string
    }

/**
 * Like-for-like swaps (same use, same unit). Every factor is traceable to ifeu 2020.
 * Keys are category slugs of the original purchase.
 */
export const ALTERNATIVES: Record<string, AlternativeTarget> = {
  beef: { kind: 'category', slug: 'chicken' },
  'ground-beef': { kind: 'category', slug: 'veggie-patty' },
  'beef-cold-cuts': { kind: 'category', slug: 'veggie-sausage' },
  pork: { kind: 'category', slug: 'tofu' },
  chicken: { kind: 'category', slug: 'tofu' },
  sausage: { kind: 'category', slug: 'veggie-sausage' },
  shrimp: { kind: 'category', slug: 'fish-frozen' },
  butter: { kind: 'category', slug: 'margarine' },
  milk: { kind: 'category', slug: 'oat-drink' },
  rice: { kind: 'category', slug: 'potatoes' },
  'ready-meal-beef': { kind: 'category', slug: 'ready-meal-vegetarian' },
  'ready-meal-meat': { kind: 'category', slug: 'ready-meal-vegetarian' },
  cheese: {
    kind: 'product',
    label: 'Veganer Käse-Ersatz',
    unit: 'kg',
    co2ePerUnit: 2.0,
    source: 'ifeu 2020, Tab. 2 Nr. 15 – Käse-Ersatz, vegane Genießerscheiben',
    sourceUrl: IFEU,
  },
  yogurt: {
    kind: 'product',
    label: 'Soja-Joghurt',
    unit: 'kg',
    co2ePerUnit: 0.6,
    source: 'ifeu 2020, Tab. 2 Nr. 7 – Joghurt-Ersatz, Soja',
    sourceUrl: IFEU,
  },
  quark: {
    kind: 'product',
    label: 'Soja-Quark',
    unit: 'kg',
    co2ePerUnit: 0.7,
    source: 'ifeu 2020, Tab. 2 Nr. 28 – Quark-Ersatz, Soja',
    sourceUrl: IFEU,
  },
  cream: {
    kind: 'product',
    label: 'Hafer-Cuisine',
    unit: 'kg',
    co2ePerUnit: 0.6,
    source: 'ifeu 2020, Tab. 2 Nr. 31 – Sahne-Ersatz, Hafer Cuisine',
    sourceUrl: IFEU,
  },
  'mineral-water': {
    kind: 'product',
    label: 'Leitungswasser',
    unit: 'l',
    co2ePerUnit: 0,
    source: 'ifeu 2020, Tab. 5 Nr. 10 – Wasser, Leitungswasser (0,0 kg CO₂e/kg)',
    sourceUrl: IFEU,
  },
}
