import { supabase } from '@/lib/supabase'
import { validateReceiptFile } from './file-validation'
import type { Receipt } from './types'

export const RECEIPTS_BUCKET = 'receipts'

export async function fetchReceipts(): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Uploads the file to `<userId>/<uuid>.<ext>` and creates the receipt row
 * (status `pending`). If the row cannot be created, the file is removed again.
 */
export async function uploadReceipt({ file, userId }: { file: File; userId: string }) {
  const validation = validateReceiptFile(file)
  if (!validation.ok) throw new Error(validation.error)
  const { kind } = validation

  const path = `${userId}/${crypto.randomUUID()}.${kind.extension}`
  const upload = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: kind.contentType, upsert: false })
  if (upload.error) throw upload.error

  const { data, error } = await supabase
    .from('receipts')
    .insert({ file_path: path, source_type: kind.sourceType, original_filename: file.name })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
    throw error
  }
  return data
}

/** Deletes the row (line items cascade), then the file. A leftover file is only logged. */
export async function deleteReceipt(receipt: Pick<Receipt, 'id' | 'file_path'>) {
  const { error } = await supabase.from('receipts').delete().eq('id', receipt.id)
  if (error) throw error

  if (receipt.file_path) {
    const removal = await supabase.storage.from(RECEIPTS_BUCKET).remove([receipt.file_path])
    if (removal.error) console.warn('Receipt file could not be removed', removal.error)
  }
}

/** `failed → pending`; the database trigger clears `error` and rejects other transitions. */
export async function retryReceipt(id: string) {
  const { error } = await supabase.from('receipts').update({ status: 'pending' }).eq('id', id)
  if (error) throw error
}
