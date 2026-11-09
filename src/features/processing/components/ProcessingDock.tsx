import { Link, useLocation } from 'react-router'
import { useReceipts } from '@/features/receipts/queries'
import { useReceiptsRealtime } from '@/features/receipts/realtime'
import { serverStepIndex, STEPS } from '../steps'

const RING = 2 * Math.PI * 18

/**
 * Floating pill while receipts are being analysed, on every page of the app. Also owns
 * the Realtime subscription, so status changes arrive wherever the user is.
 */
export function ProcessingDock({ userId }: { userId: string }) {
  useReceiptsRealtime(userId)
  const receipts = useReceipts()
  const location = useLocation()

  const running = receipts.data?.filter((receipt) => receipt.status === 'processing') ?? []
  const first = running[0]
  // The receipts page lists running analyses itself; the receipt's own page shows its progress.
  if (!first || location.pathname === '/receipts' || location.pathname === `/receipts/${first.id}`)
    return null

  const step = serverStepIndex(first)
  const current = STEPS[step]
  const name = first.merchant ?? first.original_filename ?? 'Beleg'
  const title =
    running.length > 1 ? `${running.length} Belege werden analysiert` : `${name} wird analysiert`
  const detail = current?.label ?? ''

  return (
    <>
      {/* Keeps the end of the page reachable above the fixed pill. */}
      <div aria-hidden="true" className="h-24" />
      <aside
        aria-label="Laufende Analyse"
        className="fixed inset-x-4 bottom-4 z-40 animate-rise sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        <Link
          to={`/receipts/${first.id}`}
          className="flex items-center gap-3.5 rounded-full bg-ink py-2.5 pr-5 pl-2.5 text-ink-foreground shadow-[0_18px_40px_rgba(18,20,18,.25)] transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:max-w-sm dark:ring-1 dark:ring-ink-line"
        >
          <span className="relative size-11 shrink-0">
            <svg viewBox="0 0 44 44" aria-hidden="true" className="size-11 -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                strokeWidth="4"
                className="stroke-ink-line"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - (step + 0.5) / STEPS.length)}
                className="stroke-brand transition-[stroke-dashoffset] duration-700"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-mono text-xs text-brand tabular">
              {step + 1}/{STEPS.length}
            </span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="truncate font-mono text-xs text-ink-muted">{detail} · Ansehen</span>
          </span>
        </Link>
      </aside>
    </>
  )
}
