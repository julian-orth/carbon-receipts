import { ArrowRight, Camera, Play, Receipt as ReceiptIcon, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MiniSteps } from '@/features/processing/components/MiniSteps'
import { formatKg, serverStepIndex, STEPS } from '@/features/processing/steps'
import { formatDate, formatDateTime } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import type { ReceiptTotal } from '../api'
import { useReceipts, useReceiptTotals, useRetryReceipt, useStartProcessing } from '../queries'
import { failureHelp } from '../failure'
import { canStartProcessing } from '../status'
import { useUploadFlow } from '../upload/upload-flow-context'
import type { Receipt } from '../types'
import { DeleteReceiptButton } from './DeleteReceiptButton'
import { ReceiptStatusBadge } from './ReceiptStatusBadge'

function receiptLabel(receipt: Receipt): string {
  return receipt.merchant ?? receipt.original_filename ?? 'Beleg'
}

const isInProgress = (receipt: Receipt) =>
  receipt.status === 'pending' || receipt.status === 'processing'

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold tracking-tight">
      {children}
    </h2>
  )
}

/** "In Arbeit" (live progress) and "Deine Belege" (everything else), with all list states. */
export function ReceiptList() {
  const receipts = useReceipts()
  const totals = useReceiptTotals()
  // One clock for the whole list: enables "Analyse starten" once a run looks stuck.
  const now = useNow(30_000)

  if (receipts.isPending) {
    return (
      <section aria-labelledby="receipts-list-title" className="space-y-3.5">
        <SectionTitle id="receipts-list-title">Deine Belege</SectionTitle>
        <output aria-label="Belege werden geladen" className="block space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </output>
      </section>
    )
  }

  if (receipts.isError) {
    return (
      <section aria-labelledby="receipts-list-title" className="space-y-3.5">
        <SectionTitle id="receipts-list-title">Deine Belege</SectionTitle>
        <Alert variant="destructive" role="alert">
          <AlertTitle>Belege konnten nicht geladen werden</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
            <Button variant="outline" size="sm" onClick={() => void receipts.refetch()}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  const active = receipts.data.filter(isInProgress)
  const finished = receipts.data.filter((receipt) => !isInProgress(receipt))
  const maxKg = Math.max(0.001, ...finished.map((r) => totals.data?.get(r.id)?.co2eKg ?? 0))

  return (
    <>
      {active.length > 0 && (
        <section aria-labelledby="receipts-active-title" className="space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="size-2 animate-blink rounded-full bg-success" />
            <SectionTitle id="receipts-active-title">In Arbeit</SectionTitle>
          </div>
          <ul
            aria-labelledby="receipts-active-title"
            className="divide-y overflow-hidden rounded-2xl border bg-card"
          >
            {active.map((receipt) => (
              <InProgressItem key={receipt.id} receipt={receipt} now={now} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="receipts-list-title" className="space-y-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionTitle id="receipts-list-title">Deine Belege</SectionTitle>
          {finished.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">CO₂e pro Beleg</span>
          )}
        </div>
        {receipts.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center">
            <ReceiptIcon aria-hidden className="size-8 text-muted-foreground" />
            <p className="font-medium">Noch keine Belege</p>
            <p className="text-sm text-muted-foreground">
              Lade oben ein Foto deines ersten Kassenbons hoch.
            </p>
          </div>
        ) : finished.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Sobald die Analyse fertig ist, erscheint dein Beleg hier.
          </p>
        ) : (
          <ul
            aria-labelledby="receipts-list-title"
            className="divide-y overflow-hidden rounded-2xl border bg-card"
          >
            {finished.map((receipt) => (
              <ReceiptListItem
                key={receipt.id}
                receipt={receipt}
                total={totals.data?.get(receipt.id) ?? null}
                maxKg={maxKg}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function InProgressItem({ receipt, now }: { receipt: Receipt; now: number }) {
  const start = useStartProcessing()
  const label = receiptLabel(receipt)
  const step = serverStepIndex(receipt)
  const running = receipt.status === 'processing'
  const current = STEPS[step]
  const stuck = canStartProcessing(receipt, now)

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6">
      <div
        aria-hidden="true"
        className="relative h-13 w-10 shrink-0 overflow-hidden rounded border border-paper-line/60 bg-paper"
      >
        {running && (
          <div className="absolute inset-0 animate-scan motion-reduce:hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-success" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-[1_1_200px]">
        <p className="truncate font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {running && current
            ? `Schritt ${step + 1} von ${STEPS.length} · ${current.activity}`
            : 'In der Warteschlange'}
        </p>
      </div>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
        <MiniSteps step={step} running={running} />
        <span className="font-mono text-xs text-muted-foreground">
          {running && current ? current.label : 'Wartet auf den Start'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {stuck ? (
          <Button
            variant="outline"
            className="h-10 rounded-full px-4"
            onClick={() => start.mutate(receipt.id)}
            disabled={start.isPending}
          >
            <Play aria-hidden />
            Analyse starten
          </Button>
        ) : (
          <Button asChild className="h-10 rounded-full px-4">
            <Link to={`/receipts/${receipt.id}`}>
              Fortschritt ansehen
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        <DeleteReceiptButton receipt={receipt} label={label} />
      </div>
    </li>
  )
}

function ReceiptListItem({
  receipt,
  total,
  maxKg,
}: {
  receipt: Receipt
  total: ReceiptTotal | null
  maxKg: number
}) {
  const retry = useRetryReceipt()
  const { openPicker } = useUploadFlow()
  const label = receiptLabel(receipt)
  const reviewable = receipt.status === 'review' || receipt.status === 'done'

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_7.5rem_12rem]">
      <div className="min-w-0 flex-[1_1_220px]">
        <p className="truncate font-medium">
          {reviewable ? (
            <Link
              to={`/receipts/${receipt.id}`}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:underline"
            >
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {receipt.purchased_at ? (
            <>Einkauf am {formatDate(receipt.purchased_at)}</>
          ) : (
            <>
              Hochgeladen am{' '}
              <time dateTime={receipt.created_at}>{formatDateTime(receipt.created_at)}</time>
            </>
          )}
          {total && total.itemCount > 0 && <> · {total.itemCount} Positionen</>}
        </p>
        {receipt.status === 'failed' && receipt.error && (
          <>
            <p className="mt-1 text-sm text-destructive">{receipt.error}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {failureHelp(receipt.error_code).tips[0]}
            </p>
          </>
        )}
      </div>

      {reviewable && total ? (
        <div className="flex min-w-0 flex-[1_1_180px] items-center gap-3">
          <div
            aria-hidden="true"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full origin-left animate-grow rounded-full bg-primary"
              style={{ transform: `scaleX(${total.co2eKg / maxKg})` }}
            />
          </div>
          <span className="min-w-20 text-right font-mono text-sm font-medium tabular">
            {formatKg(total.co2eKg)} kg
          </span>
        </div>
      ) : (
        <div aria-hidden="true" className="max-lg:hidden" />
      )}

      <div className="lg:justify-self-start">
        <ReceiptStatusBadge status={receipt.status} />
      </div>
      <div className="flex items-center gap-1.5 lg:justify-self-end">
        {receipt.status === 'review' && (
          <Button asChild className="h-10 rounded-full px-4">
            <Link to={`/receipts/${receipt.id}`}>Prüfen</Link>
          </Button>
        )}
        {receipt.status === 'failed' && failureHelp(receipt.error_code).canRetry && (
          <Button
            variant="outline"
            className="h-10 rounded-full px-4"
            onClick={() => retry.mutate(receipt.id)}
            disabled={retry.isPending}
          >
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        )}
        {receipt.status === 'failed' && failureHelp(receipt.error_code).canUploadNew && (
          <Button variant="outline" className="h-10 rounded-full px-4" onClick={openPicker}>
            <Camera aria-hidden />
            Neues Foto
          </Button>
        )}
        <DeleteReceiptButton receipt={receipt} label={label} />
      </div>
    </li>
  )
}
