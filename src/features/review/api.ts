import { RECEIPTS_BUCKET } from '@/features/receipts/api'
import type { Receipt } from '@/features/receipts/types'
import { supabase } from '@/lib/supabase'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import type { LineItem } from './review-logic'

export async function fetchReceipt(id: string): Promise<Receipt | null> {
  const { data, error } = await supabase.from('receipts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchLineItems(receiptId: string): Promise<LineItem[]> {
  const { data, error } = await supabase
    .from('line_items')
    .select('*')
    .eq('receipt_id', receiptId)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data
}

/** Short-lived URL for the private bucket. */
export async function fetchImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export type LineItemUpdate = {
  id: string
  normalizedName: string | null
  categoryId: string | null
  categoryChanged: boolean
  quantity: number | null
  unit: EmissionUnit | null
  co2eKg: number | null
}

/**
 * Saves a reviewed item. A changed category is also stored as the user's
 * mapping, so the next receipt with the same product is categorised correctly.
 */
export async function saveLineItem(update: LineItemUpdate): Promise<void> {
  const { error } = await supabase
    .from('line_items')
    .update({
      category_id: update.categoryId,
      quantity: update.quantity,
      unit: update.unit,
      co2e_kg: update.co2eKg,
      reviewed: true,
    })
    .eq('id', update.id)
  if (error) throw error

  if (update.categoryChanged && update.categoryId && update.normalizedName) {
    const mapping = await supabase
      .from('category_mappings')
      .upsert(
        { normalized_name: update.normalizedName, category_id: update.categoryId },
        { onConflict: 'user_id,normalized_name' },
      )
    if (mapping.error) throw mapping.error
  }
}

/** Marks all items as reviewed and moves the receipt `review → done`. */
export async function confirmReceipt(receiptId: string): Promise<void> {
  const items = await supabase
    .from('line_items')
    .update({ reviewed: true })
    .eq('receipt_id', receiptId)
    .eq('reviewed', false)
  if (items.error) throw items.error

  const { error } = await supabase
    .from('receipts')
    .update({ status: 'done' })
    .eq('id', receiptId)
    .eq('status', 'review')
  if (error) throw error
}
