import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteReceipt, fetchReceipts, retryReceipt, uploadReceipt } from './api'
import { receiptKeys } from './query-keys'

export function useReceipts() {
  return useQuery({ queryKey: receiptKeys.list(), queryFn: fetchReceipts })
}

export function useUploadReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadReceipt,
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
