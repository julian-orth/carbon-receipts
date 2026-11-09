import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { validateReceiptFile } from './file-validation'
import { prepareImage } from './image-resize'
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
 * Asks the edge function to analyse a pending receipt. A 409 means another call
 * already claimed it – that is fine, the UI follows the status via Realtime.
 */
export async function startProcessing(receiptId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-receipt', {
    body: { receipt_id: receiptId },
  })
  if (!error) return
  if (
    error instanceof FunctionsHttpError &&
    error.context instanceof Response &&
    error.context.status === 409
  ) {
    return
  }
  throw error
}

/**
 * Uploads the file to `<userId>/<uuid>.<ext>` and creates the receipt row
 * (status `pending`). If the row cannot be created, the file is removed again.
 */
export async function uploadReceipt({ file, userId }: { file: File; userId: string }) {
  // Large phone photos are downscaled first; the size limit applies to what is uploaded.
  const prepared = await prepareImage(file)
  const validation = validateReceiptFile(prepared)
  if (!validation.ok) throw new Error(validation.error)
  const { kind } = validation

  const path = `${userId}/${crypto.randomUUID()}.${kind.extension}`
  const upload = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, prepared, { contentType: kind.contentType, upsert: false })
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

  // The receipt exists now; if starting the analysis fails, it stays `pending`
  // and can be started again from the list.
  const processingStarted = await startProcessing(data.id).then(
    () => true,
    (startError: unknown) => {
      console.warn('Could not start processing', startError)
      return false
    },
  )
  return { receipt: data, processingStarted }
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

/** `failed → pending` (the trigger clears `error`), then start the analysis again. */
export async function retryReceipt(id: string) {
  const { error } = await supabase.from('receipts').update({ status: 'pending' }).eq('id', id)
  if (error) throw error
  await startProcessing(id)
}
