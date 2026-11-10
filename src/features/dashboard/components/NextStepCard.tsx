import { ArrowRight, Camera, ListChecks } from 'lucide-react'
import { Link } from 'react-router'
import { UploadButton } from '@/features/receipts/upload/UploadButton'
import { useUploadFlow } from '@/features/receipts/upload/upload-flow-context'
import { cn } from '@/lib/utils'

/**
 * What to do next: receipts waiting for a look come first; otherwise the next upload, which
 * opens the picker right here. A whole-card target, so it is large on phones too. While
 * receipts wait, a button below still offers the upload.
 */
export function NextStepCard({
  openCount,
  firstOpenId,
  showUpload = true,
}: {
  openCount: number
  firstOpenId: string | null
  /** The upload button under the review card; off where the page offers its own. */
  showUpload?: boolean
}) {
  const review = openCount > 0
  const to = review && openCount === 1 && firstOpenId ? `/receipts/${firstOpenId}` : '/receipts'
  const Icon = review ? ListChecks : Camera
  const { openPicker } = useUploadFlow()

  const content = (
    <>
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
    </>
  )
  const cardClass = cn(
    'group flex w-full items-center gap-4 rounded-3xl border p-5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-6',
    review
      ? 'border-warning/40 bg-warning-soft text-warning-foreground hover:border-warning'
      : 'bg-card hover:border-foreground/30',
  )

  if (!review) {
    return (
      <button type="button" onClick={openPicker} className={cardClass}>
        {content}
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Link to={to} className={cardClass}>
        {content}
      </Link>
      {showUpload && <UploadButton variant="outline" className="self-start" />}
    </div>
  )
}
