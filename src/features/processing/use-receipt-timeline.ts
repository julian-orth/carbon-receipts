import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { receiptKeys } from '@/features/receipts/query-keys'
import type { Receipt } from '@/features/receipts/types'
import type { ProviderVisit } from './progress'

type Timeline = { providers: ProviderVisit[]; failedAt: number | null }

/**
 * Records *when* the live view saw a provider start (fallback!) or the run fail. It
 * listens to the receipts cache, which Realtime keeps up to date; times are ms since
 * `origin`.
 */
export function useReceiptTimeline(initial: Receipt, origin: number): Timeline {
  const queryClient = useQueryClient()
  const [timeline, setTimeline] = useState<Timeline>(() => ({
    providers: initial.ai_provider ? [{ name: initial.ai_provider, at: 0 }] : [],
    failedAt: initial.status === 'failed' ? 0 : null,
  }))

  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const listKey = JSON.stringify(receiptKeys.list())
    return cache.subscribe((event) => {
      if (event.type !== 'updated' || JSON.stringify(event.query.queryKey) !== listKey) return
      const receipt = queryClient
        .getQueryData<Receipt[]>(receiptKeys.list())
        ?.find((r) => r.id === initial.id)
      if (!receipt) return
      const at = Date.now() - origin
      setTimeline((prev) => {
        // A retry after a failure starts a fresh run.
        const retried = prev.failedAt !== null && receipt.status !== 'failed'
        let providers = retried ? [] : prev.providers
        if (receipt.ai_provider && receipt.ai_provider !== providers.at(-1)?.name) {
          providers = [...providers, { name: receipt.ai_provider, at }]
        }
        const failedAt = receipt.status === 'failed' ? (prev.failedAt ?? at) : null
        return providers === prev.providers && failedAt === prev.failedAt
          ? prev
          : { providers, failedAt }
      })
    })
  }, [queryClient, initial.id, origin])

  return timeline
}
