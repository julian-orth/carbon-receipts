import type { Enums, Tables } from '@/types/db-helpers'

export type Receipt = Tables<'receipts'>
export type ReceiptStatus = Enums<'receipt_status'>
