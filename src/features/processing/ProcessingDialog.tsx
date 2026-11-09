import { ArrowRight, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useRetryReceipt, useStartProcessing } from '@/features/receipts/queries'
import { canStartProcessing } from '@/features/receipts/status'
import type { Receipt } from '@/features/receipts/types'
import type { LineItem } from '@/features/review/review-logic'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { ProcessingLog } from './components/ProcessingLog'
import { ProgressFill } from './components/ProgressFill'
import { ReceiptPhoto } from './components/ReceiptPhoto'
import { StepList } from './components/StepList'
import { buildLog, summarize } from './progress'
import { buildStory } from './story'
import { ALL_DONE, displayTarget, formatKg, providerLabel, serverStepIndex, STEP } from './steps'
import { CREEP_MS, MIN_STEP_MS } from './timing'
import { usePacedStep } from './use-paced-step'
import { useReceiptTimeline } from './use-receipt-timeline'

type ProcessingDialogProps = {
  receipt: Receipt
  /** Line items once the receipt is complete; null while not (yet) loaded. */
  items: readonly LineItem[] | null
  itemsSettled: boolean
  imageUrl: string | null
  imageLoading: boolean
  fromUpload: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Follows the analysis of one receipt in a dialog over its review page. Closing it
 * never stops anything: the analysis runs on the server either way.
 */
export function ProcessingDialog({ open, onOpenChange, ...props }: ProcessingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="Schließen, die Analyse läuft im Hintergrund weiter"
        className="sm:max-w-[46rem]"
        // Focus the dialog itself, not the first button: screen readers start at the title.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const content = event.currentTarget
          if (content instanceof HTMLElement) content.focus()
        }}
      >
        <ProcessingBody {...props} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProcessingBody({
  receipt,
  items,
  itemsSettled,
  imageUrl,
  imageLoading,
  fromUpload,
  onClose,
}: Omit<ProcessingDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const [origin] = useState(() => Date.now())
  const start = useStartProcessing()
  const retry = useRetryReceipt()
  const now = useNow(15_000)

  const failed = receipt.status === 'failed'
  const server = serverStepIndex(receipt)
  const target = failed ? server : displayTarget(server, itemsSettled)
  const { step, visits } = usePacedStep(target, {
    initial: fromUpload ? STEP.upload : target,
    minStepMs: MIN_STEP_MS,
    origin,
  })
  const { providers, failedAt } = useReceiptTimeline(receipt, origin)
  const summary = useMemo(() => (items ? summarize(items) : null), [items])

  const done = !failed && step === ALL_DONE
  const running = !failed && !done
  const waiting = receipt.status === 'pending' && step === STEP.read

  const story = buildStory({
    step,
    failed,
    done,
    waiting,
    error: receipt.error,
    summary: step >= STEP.match ? summary : null,
    providers: providers.map((provider) => providerLabel(provider.name)),
  })
  const log = buildLog({
    visits,
    providers,
    status: receipt.status,
    error: receipt.error,
    failedAt,
    fromUpload,
    summary: step >= STEP.match ? summary : null,
  })
  const overall = done ? 1 : step / ALL_DONE
  const name = receipt.merchant ?? receipt.original_filename

  return (
    <>
      <div aria-hidden="true" className="relative h-1 shrink-0 overflow-hidden bg-muted">
        <ProgressFill
          value={overall}
          creepTo={running && !waiting ? (step + 0.9) / ALL_DONE : undefined}
          creepMs={running ? (CREEP_MS[step] ?? 0) : 0}
          className={cn(failed ? 'bg-destructive' : done ? 'bg-success' : 'bg-foreground')}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6 sm:px-7 sm:pt-6">
        <p className="truncate pr-10 font-mono text-xs text-muted-foreground">
          {name ?? 'Beleg'} · Analyse
        </p>
        <DialogTitle
          key={story.title}
          className="mt-1.5 animate-rise pr-10 text-xl leading-tight font-semibold tracking-tight text-balance sm:text-2xl"
        >
          {story.title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {story.description}
        </DialogDescription>

        <div className="mt-6 grid gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <ReceiptPhoto
            url={imageUrl}
            loading={imageLoading}
            scanning={running && step === STEP.read && !waiting}
            className="max-sm:hidden"
          />
          <div className="flex min-w-0 flex-col gap-5">
            <StepList
              step={step}
              failed={failed}
              waiting={waiting}
              visits={visits}
              origin={origin}
              tags={story.tags}
            />
            {done && summary && (
              <dl className="grid animate-rise grid-cols-3 gap-2">
                <Stat label="Positionen" value={String(summary.count)} />
                <Stat label="kg CO₂e" value={formatKg(summary.totalKg)} />
                <Stat
                  label="zu prüfen"
                  value={String(summary.attention)}
                  highlight={summary.attention > 0}
                />
              </dl>
            )}
            <ProcessingLog entries={log} defaultOpen={failed} />
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3.5 sm:px-7">
        {(start.isError || retry.isError) && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            Das hat nicht geklappt. Bitte versuche es erneut.
          </p>
        )}
        {running && !(start.isError || retry.isError) && (
          <p className="mr-auto text-sm text-muted-foreground max-sm:basis-full">
            Du musst nicht warten, die Analyse läuft im Hintergrund weiter.
          </p>
        )}
        {done || failed ? (
          <Button asChild variant="outline" className="max-sm:flex-1">
            <Link to="/receipts">Weiterer Beleg</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={onClose} className="max-sm:flex-1">
            Im Hintergrund weiter
          </Button>
        )}
        {waiting && canStartProcessing(receipt, now) && (
          <Button
            onClick={() => start.mutate(receipt.id)}
            disabled={start.isPending}
            className="max-sm:flex-1"
          >
            {start.isPending ? <Spinner /> : <Play aria-hidden className="fill-current" />}
            Analyse starten
          </Button>
        )}
        {failed && (
          <Button
            onClick={() => retry.mutate(receipt.id)}
            disabled={retry.isPending}
            className="max-sm:flex-1"
          >
            {retry.isPending ? <Spinner /> : <RotateCcw aria-hidden />}
            Erneut versuchen
          </Button>
        )}
        {done && (
          <Button onClick={onClose} className="animate-pop max-sm:flex-1">
            {summary && summary.attention > 0 ? 'Positionen prüfen' : 'Zum Beleg'}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </footer>

      <p className="sr-only" aria-live="polite">
        {story.title}
      </p>
    </>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-0.5 rounded-xl px-3 py-2.5',
        highlight ? 'bg-warning-soft text-warning-foreground' : 'bg-muted',
      )}
    >
      <dt className="text-xs opacity-80">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular">{value}</dd>
    </div>
  )
}
