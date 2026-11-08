import { RECEIPTS_BUCKET } from '@/features/receipts/api'
import type { Receipt } from '@/features/receipts/types'
import { supabase } from '@/lib/supabase'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import type { EmissionCategory } from '@/features/categories'
import { type Learned, learnedUpdate, type LineItem } from './review-logic'

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
  quantity: number | null
  unit: EmissionUnit | null
  co2eKg: number | null
  /** Factor of the chosen category, needed to recalculate other open items. */
  category: EmissionCategory | null
}

/**
 * Saves a reviewed item and learns from it: category and amount become the user's
 * mapping for this product, and other open items of the same product are updated
 * right away. Returns how many other items were updated.
 */
export async function saveLineItem(update: LineItemUpdate): Promise<{ appliedTo: number }> {
  const { error } = await supabase
    .from('line_items')
    .update({
      category_id: update.categoryId,
      quantity: update.quantity,
      unit: update.unit,
      quantity_source: update.quantity === null ? null : 'user',
      co2e_kg: update.co2eKg,
      reviewed: true,
    })
    .eq('id', update.id)
  if (error) throw error

  if (!update.normalizedName || !update.categoryId || !update.category) return { appliedTo: 0 }
  const learned: Learned = {
    categoryId: update.categoryId,
    quantity: update.quantity,
    unit: update.unit,
  }

  const mapping = await supabase.from('category_mappings').upsert(
    {
      normalized_name: update.normalizedName,
      category_id: learned.categoryId,
      quantity: learned.quantity,
      unit: learned.unit,
    },
    { onConflict: 'user_id,normalized_name' },
  )
  if (mapping.error) throw mapping.error

  const { data: open, error: openError } = await supabase
    .from('line_items')
    .select('id, category_id, quantity, unit, quantity_source, price')
    .eq('normalized_name', update.normalizedName)
    .eq('reviewed', false)
    .neq('id', update.id)
  if (openError) throw openError

  let appliedTo = 0
  for (const item of open) {
    const next = learnedUpdate(item, learned, update.category)
    if (!next) continue
    const { error: applyError } = await supabase.from('line_items').update(next).eq('id', item.id)
    if (applyError) throw applyError
    appliedTo++
  }
  return { appliedTo }
}

/**
 * Learns every categorised item of the receipt, marks all items as reviewed and
 * moves the receipt `review → done`.
 */
export async function confirmReceipt(receiptId: string): Promise<void> {
  const { data: items, error: itemsError } = await supabase
    .from('line_items')
    .select('normalized_name, category_id, quantity, unit')
    .eq('receipt_id', receiptId)
  if (itemsError) throw itemsError

  const learnable = items.filter(
    (item): item is typeof item & { normalized_name: string; category_id: string } =>
      item.normalized_name !== null && item.category_id !== null,
  )
  // Two batches, so an item without an amount does not erase an amount learned earlier.
  const withAmount = learnable.filter((item) => item.quantity !== null && item.unit !== null)
  const withoutAmount = learnable.filter((item) => item.quantity === null || item.unit === null)
  for (const batch of [
    withAmount.map(({ normalized_name, category_id, quantity, unit }) => ({
      normalized_name,
      category_id,
      quantity,
      unit,
    })),
    withoutAmount.map(({ normalized_name, category_id }) => ({ normalized_name, category_id })),
  ]) {
    if (batch.length === 0) continue
    const unique = [...new Map(batch.map((row) => [row.normalized_name, row])).values()]
    const { error } = await supabase
      .from('category_mappings')
      .upsert(unique, { onConflict: 'user_id,normalized_name' })
    if (error) throw error
  }

  const reviewed = await supabase
    .from('line_items')
    .update({ reviewed: true })
    .eq('receipt_id', receiptId)
    .eq('reviewed', false)
  if (reviewed.error) throw reviewed.error

  const { error } = await supabase
    .from('receipts')
    .update({ status: 'done' })
    .eq('id', receiptId)
    .eq('status', 'review')
  if (error) throw error
}
