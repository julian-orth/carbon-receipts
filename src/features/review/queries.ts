import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { receiptKeys } from '@/features/receipts/query-keys'
import {
  addLineItem,
  confirmReceipt,
  deleteLineItem,
  fetchDuplicateReceipts,
  fetchImageUrl,
  fetchLineItems,
  saveLineItem,
  updateReceiptDetails,
} from './api'
import type { NewLineItem } from './review-logic'
import { reviewKeys } from './query-keys'

export function useLineItems(receiptId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reviewKeys.items(receiptId),
    queryFn: () => fetchLineItems(receiptId),
    enabled,
  })
}

export function useReceiptImage(path: string | null) {
  return useQuery({
    queryKey: reviewKeys.image(path ?? ''),
    queryFn: () => fetchImageUrl(path ?? ''),
    enabled: path !== null,
    staleTime: 5 * 60_000, // signed URL is valid for 10 minutes
  })
}

export function useSaveLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveLineItem,
    // Learning can update open items on other receipts too.
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
  })
}

export function useConfirmReceipt(receiptId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => confirmReceipt(receiptId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewKeys.items(receiptId) }),
        queryClient.invalidateQueries({ queryKey: receiptKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  })
}

export function useDuplicateReceipts(receiptId: string, enabled: boolean) {
  return useQuery({
    queryKey: reviewKeys.duplicates(receiptId),
    queryFn: () => fetchDuplicateReceipts(receiptId),
    enabled,
  })
}

/** Items and details change what the receipt contributes: lists, duplicates and dashboard follow. */
function useRefreshAfterEdit() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
      queryClient.invalidateQueries({ queryKey: receiptKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

export function useAddLineItem(receiptId: string) {
  const refresh = useRefreshAfterEdit()
  return useMutation({
    mutationFn: (item: NewLineItem) => addLineItem(receiptId, item),
    onSettled: refresh,
  })
}

export function useDeleteLineItem() {
  const refresh = useRefreshAfterEdit()
  return useMutation({ mutationFn: deleteLineItem, onSettled: refresh })
}

export function useUpdateReceiptDetails() {
  const refresh = useRefreshAfterEdit()
  return useMutation({ mutationFn: updateReceiptDetails, onSettled: refresh })
}
