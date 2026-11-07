import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchGroupTotals,
  fetchHotspots,
  fetchMonthlyGoal,
  fetchMonthlyTotals,
  saveMonthlyGoal,
} from './api'
import { dashboardKeys } from './query-keys'

export function useMonthlyTotals(fromMonth: string) {
  return useQuery({
    queryKey: dashboardKeys.totals(fromMonth),
    queryFn: () => fetchMonthlyTotals(fromMonth),
  })
}

export function useGroupTotals(fromMonth: string) {
  return useQuery({
    queryKey: dashboardKeys.groups(fromMonth),
    queryFn: () => fetchGroupTotals(fromMonth),
  })
}

export function useHotspots(fromMonth: string) {
  return useQuery({
    queryKey: dashboardKeys.hotspots(fromMonth),
    queryFn: () => fetchHotspots(fromMonth),
  })
}

export function useMonthlyGoal() {
  return useQuery({ queryKey: dashboardKeys.goal(), queryFn: fetchMonthlyGoal })
}

export function useSaveMonthlyGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ targetKg, existingId }: { targetKg: number; existingId: string | null }) =>
      saveMonthlyGoal(targetKg, existingId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardKeys.goal() }),
  })
}
