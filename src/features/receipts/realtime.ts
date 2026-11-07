import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { receiptKeys } from './query-keys'
import type { Receipt } from './types'

export type ReceiptChange =
  { eventType: 'INSERT' | 'UPDATE'; receipt: Receipt } | { eventType: 'DELETE'; id: string }

const byNewest = (a: Receipt, b: Receipt) => b.created_at.localeCompare(a.created_at)

/** Applies a realtime change to the cached list. Pure, so it is unit-tested. */
export function applyReceiptChange(
  list: Receipt[] | undefined,
  change: ReceiptChange,
): Receipt[] | undefined {
  if (!list) return list
  if (change.eventType === 'DELETE') return list.filter((r) => r.id !== change.id)

  const exists = list.some((r) => r.id === change.receipt.id)
  const next = exists
    ? list.map((r) => (r.id === change.receipt.id ? change.receipt : r))
    : [...list, change.receipt]
  return next.toSorted(byNewest)
}

function toChange(payload: RealtimePostgresChangesPayload<Receipt>): ReceiptChange | null {
  if (payload.eventType === 'DELETE') {
    return payload.old.id ? { eventType: 'DELETE', id: payload.old.id } : null
  }
  return { eventType: payload.eventType, receipt: payload.new }
}

/**
 * Keeps the receipts list in sync with status changes made by the processing
 * pipeline. After (re)subscribing the list is refetched, so events missed while
 * disconnected are not lost.
 */
export function useReceiptsRealtime(userId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`receipts:${userId}`)
      .on<Receipt>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `user_id=eq.${userId}` },
        (payload) => {
          const change = toChange(payload)
          if (!change) return
          queryClient.setQueryData<Receipt[]>(receiptKeys.list(), (list) =>
            applyReceiptChange(list, change),
          )
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void queryClient.invalidateQueries({ queryKey: receiptKeys.list() })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
}
