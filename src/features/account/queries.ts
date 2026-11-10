import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAccount,
  fetchAiUsageToday,
  fetchExport,
  fetchProfile,
  updateDisplayName,
} from './api'

const accountKeys = {
  all: ['account'] as const,
  profile: () => [...accountKeys.all, 'profile'] as const,
  usage: () => [...accountKeys.all, 'usage'] as const,
}

export function useProfile() {
  return useQuery({ queryKey: accountKeys.profile(), queryFn: fetchProfile })
}

export function useAiUsageToday() {
  return useQuery({ queryKey: accountKeys.usage(), queryFn: fetchAiUsageToday })
}

export function useUpdateDisplayName(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (displayName: string | null) => updateDisplayName(userId, displayName),
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountKeys.profile() }),
  })
}

export function useExportData(email: string | undefined) {
  return useMutation({ mutationFn: () => fetchExport(email) })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAccount,
    // Nothing of the deleted account may stay in the cache.
    onSuccess: () => queryClient.clear(),
  })
}
