import { ArrowRight, Camera, ListChecks } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * What to do next: receipts waiting for a look come first; otherwise the next upload.
 * A whole-card link, so the target is large on phones too.
 */
export function NextStepCard({
  openCount,
  firstOpenId,
}: {
  openCount: number
  firstOpenId: string | null
}) {
  const review = openCount > 0
  const to = review && openCount === 1 && firstOpenId ? `/receipts/${firstOpenId}` : '/receipts'
  const Icon = review ? ListChecks : Camera

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-4 rounded-3xl border p-5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-6',
        review
          ? 'border-warning/40 bg-warning-soft text-warning-foreground hover:border-warning'
          : 'bg-card hover:border-foreground/30',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-2xl',
          review ? 'bg-warning/15' : 'bg-brand text-brand-foreground',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">
          {review
            ? `${openCount} ${openCount === 1 ? 'Beleg wartet' : 'Belege warten'} auf dich`
            : 'Neuen Beleg hochladen'}
        </span>
        <span className={cn('text-sm', review ? 'opacity-85' : 'text-muted-foreground')}>
          {review
            ? 'Kurz prüfen, dann zählen sie in der Übersicht.'
            : 'Foto vom Kassenbon – den Rest rechnen wir aus.'}
        </span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}
