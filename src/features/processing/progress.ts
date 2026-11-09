import { attentionReasons, type LineItem, UNIT_LABEL } from '@/features/review/review-logic'

export type Summary = {
  count: number
  withCo2e: number
  totalKg: number
  attention: number
  learned: number
  estimated: number
}

export function summarize(items: readonly LineItem[]): Summary {
  return {
    count: items.length,
    withCo2e: items.filter((item) => item.co2e_kg !== null).length,
    totalKg: items.reduce((sum, item) => sum + (item.co2e_kg ?? 0), 0),
    attention: items.filter((item) => attentionReasons(item).length > 0).length,
    learned: items.filter((item) => item.quantity_source === 'learned').length,
    estimated: items.filter((item) => item.quantity_source === 'estimated').length,
  }
}

export type Visit = { step: number; at: number }
export type ProviderVisit = { name: string; at: number }

const priceFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const quantityFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

/** One printed line on the drawn receipt in the progress dialog. */
export type PaperLine = {
  id: string
  name: string
  price: string | null
  categoryId: string | null
  /** "0,3 kg", "~0,5 kg" when estimated; null without amount. */
  quantity: string | null
  co2eKg: number | null
  needsLook: boolean
}

export function toPaperLine(item: LineItem): PaperLine {
  return {
    id: item.id,
    name: item.raw_text,
    price: item.price === null ? null : priceFormatter.format(item.price),
    categoryId: item.category_id,
    quantity:
      item.quantity === null || item.unit === null
        ? null
        : `${item.quantity_source === 'estimated' ? '~' : ''}${quantityFormatter.format(item.quantity)} ${UNIT_LABEL[item.unit]}`,
    co2eKg: item.co2e_kg,
    needsLook: attentionReasons(item).length > 0,
  }
}
