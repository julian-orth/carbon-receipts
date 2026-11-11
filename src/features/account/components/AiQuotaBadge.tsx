import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useReceipts } from '@/features/receipts/queries'
import { cn } from '@/lib/utils'
import { quotaUsage } from '../account-logic'
import { useAiUsageToday, useProfile, useRefreshAiUsage } from '../queries'

/**
 * Header chip: how many AI analyses are left today. The free AI tiers are limited, so the
 * user should see the limit before an upload fails, not after. Hidden while loading or if
 * the numbers cannot be read – it is a hint, nothing else depends on it.
 */
export function AiQuotaBadge() {
  const profile = useProfile()
  const usage = useAiUsageToday()
  const receipts = useReceipts()
  const refreshUsage = useRefreshAiUsage()

  // An analysis uses the quota when it starts: refetch whenever a receipt changes its status.
  const statuses = receipts.data?.map((receipt) => `${receipt.id}:${receipt.status}`).join(',')
  useEffect(() => {
    if (statuses !== undefined) refreshUsage()
  }, [statuses, refreshUsage])

  if (profile.data == null || usage.data === undefined) return null
  const { remaining, quota } = quotaUsage(usage.data, profile.data.daily_ai_quota)
  const used = remaining === 0

  return (
    <Link
      to="/konto"
      aria-label={
        used
          ? `Tageslimit erreicht: ${quota} von ${quota} KI-Analysen genutzt. Zum Konto.`
          : `Noch ${remaining} von ${quota} KI-Analysen heute. Zum Konto.`
      }
      title="KI-Analysen, die du heute noch hast"
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs tabular-nums transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-3',
        used ? 'border-destructive/50 text-destructive' : 'text-muted-foreground',
      )}
    >
      <Sparkles aria-hidden className="size-3.5" />
      <span aria-hidden="true">
        {remaining}/{quota}
      </span>
    </Link>
  )
}
