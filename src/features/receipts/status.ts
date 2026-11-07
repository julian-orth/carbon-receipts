import type { ReceiptStatus } from './types'

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  pending: 'In Warteschlange',
  processing: 'Wird analysiert',
  review: 'Bitte prüfen',
  done: 'Fertig',
  failed: 'Fehlgeschlagen',
}
