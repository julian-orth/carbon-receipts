import type { ReceiptStatus } from './types'

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  pending: 'In Warteschlange',
  processing: 'Wird analysiert',
  review: 'Bitte prüfen',
  done: 'Fertig',
  failed: 'Fehlgeschlagen',
}

/** Must match `claim_receipt` in the database: a crashed run can be restarted after this. */
export const STUCK_AFTER_MS = 5 * 60_000

/** Pending receipts and runs that seem to have crashed can be (re)started by the user. */
export function canStartProcessing(
  receipt: { status: ReceiptStatus; updated_at: string },
  now: number,
): boolean {
  if (receipt.status === 'pending') return true
  return receipt.status === 'processing' && now - Date.parse(receipt.updated_at) > STUCK_AFTER_MS
}
