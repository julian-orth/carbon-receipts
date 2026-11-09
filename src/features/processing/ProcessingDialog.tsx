import { ArrowRight, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { EmissionCategory } from '@/features/categories/categories'
import { useRetryReceipt, useStartProcessing } from '@/features/receipts/queries'
import { canStartProcessing } from '@/features/receipts/status'
import type { Receipt } from '@/features/receipts/types'
import type { LineItem } from '@/features/review/review-logic'
import { useNow } from '@/lib/use-now'
import { ProgressPanel } from './components/ProgressPanel'
import { ReceiptPaper } from './components/ReceiptPaper'
import { printSchedule, summarize, toPaperLine } from './progress'
import { buildStory } from './story'
import { ALL_DONE, displayTarget, serverStepIndex, STEP } from './steps'
import { MIN_STEP_MS, PRINT_BUDGET_MS, PRINT_MAX_GAP_MS } from './timing'
import { usePacedStep } from './use-paced-step'
import { useReceiptTimeline } from './use-receipt-timeline'

type ProcessingDialogProps = {
  receipt: Receipt
  /** Line items once the receipt is complete; null while not (yet) loaded. */
  items: readonly LineItem[] | null
  itemsSettled: boolean
  itemsError: boolean
  onRetryItems: () => void
  categoriesById: ReadonlyMap<string, EmissionCategory>
  imageUrl: string | null
  fromUpload: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Follows the analysis of one receipt in a dialog over its review page. Closing it
 * never stops anything: the analysis runs on the server either way.
 */
export function ProcessingDialog({
  open,
  onOpenChange,
  fromUpload,
  ...props
}: ProcessingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="Schließen, die Analyse läuft im Hintergrund weiter"
        // Continues the upload dialog seamlessly: no second entrance animation.
        animated={!fromUpload}
        className="sm:max-w-5xl md:h-[min(90svh,46rem)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const content = event.currentTarget
          if (content instanceof HTMLElement) content.focus()
        }}
      >
        <ProcessingBody {...props} fromUpload={fromUpload} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProcessingBody({
  receipt,
  items,
  itemsSettled,
  itemsError,
  onRetryItems,
  categoriesById,
  imageUrl,
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
  const summary = useMemo(() => (items ? summarize(items) : null), [items])
  const lines = useMemo(() => (items ? items.map(toPaperLine) : null), [items])
  const print = printSchedule(lines?.length ?? 0, {
    budgetMs: PRINT_BUDGET_MS,
    maxGapMs: PRINT_MAX_GAP_MS,
  })
  // "Angaben prüfen" lasts until the last line is printed; categories and CO₂e follow after.
  const { step } = usePacedStep(target, {
    initial: fromUpload ? STEP.upload : target,
    minStepMs: (current) =>
      current === STEP.validate ? Math.max(MIN_STEP_MS, print.totalMs) : MIN_STEP_MS,
    origin,
  })
  const { providers } = useReceiptTimeline(receipt, origin)

  const done = !failed && step === ALL_DONE
  const waiting = receipt.status === 'pending' && step === STEP.read
  const story = buildStory({
    step,
    failed,
    done,
    waiting,
    error: receipt.error,
    summary: step >= STEP.match ? summary : null,
  })
  const actionFailed = start.isError || retry.isError

  return (
    <ProgressPanel
      step={step}
      failed={failed}
      waiting={waiting}
      title={story.title}
      description={story.description}
      fileName={receipt.merchant ?? receipt.original_filename}
      slow={providers.length > 1}
      paper={
        <ReceiptPaper
          step={step}
          failed={failed}
          merchant={receipt.merchant}
          purchasedAt={receipt.purchased_at}
          lines={lines}
          categoriesById={categoriesById}
          totalKg={summary?.totalKg ?? 0}
          photoUrl={imageUrl}
          printGapMs={print.gapMs}
          linesError={itemsError}
          onRetryLines={onRetryItems}
        />
      }
      actions={
        <>
          {actionFailed && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              Das hat nicht geklappt. Bitte versuche es erneut.
            </p>
          )}
          {done || failed ? (
            <Button asChild variant="outline" size="lg" className="max-sm:flex-1">
              <Link to="/receipts">Weiterer Beleg</Link>
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={onClose} className="max-sm:flex-1">
              Im Hintergrund weiter
            </Button>
          )}
          {waiting && canStartProcessing(receipt, now) && (
            <Button
              size="lg"
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
              size="lg"
              onClick={() => retry.mutate(receipt.id)}
              disabled={retry.isPending}
              className="max-sm:flex-1"
            >
              {retry.isPending ? <Spinner /> : <RotateCcw aria-hidden />}
              Erneut versuchen
            </Button>
          )}
          {done && (
            <Button size="lg" onClick={onClose} className="animate-pop max-sm:flex-1">
              {summary && summary.attention > 0 ? 'Positionen prüfen' : 'Zum Beleg'}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </>
      }
    />
  )
}
