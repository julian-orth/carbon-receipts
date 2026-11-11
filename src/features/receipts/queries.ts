import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createManualReceipt,
  deleteReceipt,
  fetchReceipts,
  fetchReceiptTotals,
  retryReceipt,
  startManualEntry,
  startProcessing,
  uploadReceipt,
} from './api'
import { receiptKeys } from './query-keys'
import { applyReceiptChange } from './realtime'
import type { Receipt } from './types'

export function useReceipts() {
  return useQuery({ queryKey: receiptKeys.list(), queryFn: fetchReceipts })
}

export function useReceiptTotals() {
  return useQuery({ queryKey: receiptKeys.totals(), queryFn: fetchReceiptTotals })
}

export function useUploadReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadReceipt,
    // The receipt page opens right away; it must find the new receipt in the cache.
    onSuccess: ({ receipt }) =>
      queryClient.setQueryData<Receipt[]>(receiptKeys.list(), (list) =>
        applyReceiptChange(list, { eventType: 'INSERT', receipt }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteReceipt,
    onSettled: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}

export function useRetryReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: retryReceipt,
    onSettled: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}

export function useStartProcessing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startProcessing,
    onSettled: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}

export function useCreateManualReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createManualReceipt,
    // Awaited before the caller continues, so the receipt page finds the receipt in the list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}

export function useStartManualEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startManualEntry,
    onSettled: () => queryClient.invalidateQueries({ queryKey: receiptKeys.list() }),
  })
}
