import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { receiptKeys } from '@/features/receipts/query-keys'
import { confirmReceipt, fetchImageUrl, fetchLineItems, fetchReceipt, saveLineItem } from './api'
import { reviewKeys } from './query-keys'

export function useReviewReceipt(id: string) {
  return useQuery({ queryKey: reviewKeys.receipt(id), queryFn: () => fetchReceipt(id) })
}

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
        queryClient.invalidateQueries({ queryKey: reviewKeys.receipt(receiptId) }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.items(receiptId) }),
        queryClient.invalidateQueries({ queryKey: receiptKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  })
}
