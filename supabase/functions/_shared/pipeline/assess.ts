import type { ReceiptExtraction } from './schema.ts'

/** Reasons an analysis can fail for with a message that helps the user. */
export type ExtractionFailure = 'not_a_receipt' | 'unreadable' | 'cut_off' | 'no_items'

/** Every `receipts.error_code`: the extraction failures plus the operational ones. */
export type FailureCode = ExtractionFailure | 'quota' | 'ai_unavailable' | 'no_file' | 'unknown'

/** Non-fatal observations stored with a successful analysis. */
export type ReceiptNote =
  'cut_off' | 'unreadable' | 'multiple_receipts' | 'foreign_currency' | 'non_food_only'

export const FAILURE_MESSAGE: Record<ExtractionFailure, string> = {
  not_a_receipt: 'Das sieht nicht nach einem Kassenbon aus.',
  unreadable: 'Der Bon ist auf dem Foto nicht gut genug lesbar.',
  cut_off: 'Der Bon ist auf dem Foto abgeschnitten.',
  no_items: 'Auf dem Beleg wurden keine Positionen erkannt.',
}

/** Why an extraction cannot be used at all, or null when there is something to review. */
export function assessExtraction(extraction: ReceiptExtraction): ExtractionFailure | null {
  if (extraction.document_type === 'not_a_receipt') return 'not_a_receipt'
  if (extraction.items.length > 0) return null
  if (extraction.issues.includes('unreadable')) return 'unreadable'
  if (extraction.issues.includes('cut_off')) return 'cut_off'
  return 'no_items'
}

export function isForeignCurrency(currency: string | null): boolean {
  return currency !== null && currency !== 'EUR' && currency !== '€'
}

/**
 * Notes for the review page. `lineItems` are the rows that will be stored: when none of
 * them has a category, nothing on the receipt is food, whatever the model said.
 */
export function collectNotes(
  extraction: ReceiptExtraction,
  lineItems: readonly { category_id: string | null }[],
): ReceiptNote[] {
  const notes: ReceiptNote[] = []
  for (const issue of extraction.issues) {
    if (issue !== 'non_food_only') notes.push(issue)
  }
  if (isForeignCurrency(extraction.currency)) notes.push('foreign_currency')
  if (
    extraction.issues.includes('non_food_only') ||
    (lineItems.length > 0 && lineItems.every((item) => item.category_id === null))
  ) {
    notes.push('non_food_only')
  }
  return notes
}
