import { z } from 'zod'
import { parseDecimal } from '../emissions/units.ts'

/** Models sometimes return "1,99" or "0.5" as strings – accept both, reject garbage. */
function toNumberish(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim().replace(/\s*(€|eur)$/i, '')
  if (trimmed === '') return null
  const negative = trimmed.startsWith('-')
  const parsed = parseDecimal(negative ? trimmed.slice(1) : trimmed)
  return parsed === null ? value : negative ? -parsed : parsed
}

const looseNumber = z.preprocess(toNumberish, z.number().finite())
const looseNullableNumber = z.preprocess(toNumberish, z.number().finite().nullable())

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable(),
  )

const extractedItemSchema = z.object({
  raw_text: z.string().trim().min(1).max(200),
  quantity: looseNullableNumber.default(null),
  unit: optionalText(12).default(null),
  /** Typical pack size when the receipt shows no amount – a suggestion, flagged for review. */
  estimated_quantity: looseNullableNumber.default(null),
  estimated_unit: optionalText(12).default(null),
  /** Total price of the line in EUR; negative for discounts/deposit returns. */
  price: looseNullableNumber.default(null),
  category_slug: optionalText(64).default(null),
  confidence: looseNumber.pipe(z.number().min(0).max(1)).catch(0),
})

/** What the model may report about the photo itself; anything else is dropped. */
const EXTRACTION_ISSUES = ['unreadable', 'cut_off', 'multiple_receipts', 'non_food_only'] as const
type ExtractionIssue = (typeof EXTRACTION_ISSUES)[number]

const issueSet: ReadonlySet<string> = new Set(EXTRACTION_ISSUES)

const issuesSchema = z
  .array(z.unknown())
  .catch([])
  .transform((values) => [
    ...new Set(
      values.filter((v): v is ExtractionIssue => typeof v === 'string' && issueSet.has(v)),
    ),
  ])

const receiptExtractionSchema = z.object({
  /** `not_a_receipt`: the photo shows something else (selfie, screenshot, a letter ...). */
  document_type: z.enum(['receipt', 'not_a_receipt']).catch('receipt').default('receipt'),
  /** ISO code printed on the receipt; null when unknown. Normalised to upper case. */
  currency: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toUpperCase() || null : null),
      z.string().max(8).nullable(),
    )
    .catch(null)
    .default(null),
  issues: issuesSchema.default([]),
  merchant: optionalText(120).default(null),
  purchased_at: z.iso.date().nullable().catch(null).default(null),
  items: z.array(extractedItemSchema).max(150),
})

export type ExtractedItem = z.infer<typeof extractedItemSchema>
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>

/** Throws a ZodError with a readable summary if the model output is unusable. */
export function parseReceiptExtraction(raw: unknown): ReceiptExtraction {
  return receiptExtractionSchema.parse(raw)
}
