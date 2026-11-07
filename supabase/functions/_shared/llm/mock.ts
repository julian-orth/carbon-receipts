import type { LlmProvider } from './types.ts'

/**
 * Deterministic provider for local development, E2E tests and the demo without
 * API keys (`LLM_PROVIDERS=mock`). Always "recognizes" the same receipt.
 */
export function createMockProvider(): LlmProvider {
  return {
    name: 'mock',
    generateJson() {
      return Promise.resolve({
        merchant: 'Beispielmarkt',
        purchased_at: new Date().toISOString().slice(0, 10),
        items: [
          {
            raw_text: 'Rinderhack 500g',
            quantity: 0.5,
            unit: 'kg',
            price: 5.49,
            category_slug: 'ground-beef',
            confidence: 0.95,
          },
          {
            raw_text: 'Bio Vollmilch 3,8% 1L',
            quantity: 1,
            unit: 'l',
            price: 1.39,
            category_slug: 'milk',
            confidence: 0.92,
          },
          {
            raw_text: 'Bananen',
            quantity: 1.2,
            unit: 'kg',
            price: 1.67,
            category_slug: 'bananas',
            confidence: 0.9,
          },
          {
            raw_text: 'Gouda jung Scheiben',
            quantity: null,
            unit: null,
            price: 2.29,
            category_slug: 'cheese',
            confidence: 0.6,
          },
          {
            raw_text: 'Haferdrink Barista',
            quantity: 1,
            unit: 'l',
            price: 1.95,
            category_slug: 'oat-drink',
            confidence: 0.55,
          },
        ],
      })
    },
  }
}
