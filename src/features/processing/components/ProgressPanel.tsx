import { Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ALL_DONE, STEPS } from '../steps'
import { CREEP_MS } from '../timing'
import { MiniSteps } from './MiniSteps'
import { ProgressFill } from './ProgressFill'
import { StepList } from './StepList'

type ProgressPanelProps = {
  step: number
  failed: boolean
  waiting: boolean
  title: string
  description: string
  fileName: string | null
  /** The analysis needs longer than usual (e.g. a fallback after an overloaded service). */
  slow?: boolean
  /** The drawn receipt. */
  paper: ReactNode
  /** Buttons for the footer. */
  actions: ReactNode
}

/**
 * Shared body of the progress dialogs (upload and analysis): the receipt filling up on
 * the left, the steps on the right; on phones the receipt sits between title and steps.
 */
export function ProgressPanel({
  step,
  failed,
  waiting,
  title,
  description,
  fileName,
  slow = false,
  paper,
  actions,
}: ProgressPanelProps) {
  const done = !failed && step >= ALL_DONE
  const running = !failed && !done && !waiting
  const overall = done ? 1 : step / ALL_DONE

  return (
    <>
      <div aria-hidden="true" className="relative h-1 shrink-0 overflow-hidden bg-muted">
        <ProgressFill
          value={overall}
          creepTo={running ? (step + 0.9) / ALL_DONE : undefined}
          creepMs={running ? (CREEP_MS[step] ?? 0) : 0}
          className={cn(failed ? 'bg-destructive' : done ? 'bg-success' : 'bg-foreground')}
        />
      </div>

      {/* Scrolls as a whole on phones, so it must be reachable by keyboard there. */}
      <section
        aria-label="Fortschritt"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
        tabIndex={0}
        className="grid min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:overflow-hidden"
      >
        <div className="order-2 flex justify-center bg-muted px-5 py-7 md:order-1 md:items-start md:overflow-y-auto md:px-10 md:py-10">
          {paper}
        </div>

        <div className="order-1 flex flex-col gap-5 px-5 pt-5 pb-5 md:order-2 md:overflow-y-auto md:border-l md:px-7 md:pt-7">
          <div className="flex flex-col gap-2 pr-10">
            {fileName && (
              <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {fileName}
              </p>
            )}
            <DialogTitle
              key={title}
              className="animate-rise text-xl leading-snug font-semibold tracking-tight text-balance md:text-2xl"
            >
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          </div>

          {/* Phones: one line instead of the whole list, so the receipt stays in view. */}
          <div className="flex flex-col gap-2 md:hidden" aria-hidden="true">
            <MiniSteps step={done ? ALL_DONE : step} running={running} />
            <p className="text-xs text-muted-foreground">
              {done
                ? 'Alle Schritte erledigt'
                : `Schritt ${Math.min(step, ALL_DONE - 1) + 1} von ${STEPS.length} · ${STEPS[step]?.label ?? ''}`}
            </p>
          </div>
          <div className="max-md:sr-only">
            <StepList step={step} failed={failed} waiting={waiting} />
          </div>

          {slow && running && (
            <p className="flex animate-rise items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
              Dauert gerade etwas länger als sonst. Einen Moment noch …
            </p>
          )}
        </div>
      </section>

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-card px-5 py-3.5 md:px-7">
        {actions}
      </footer>

      <p className="sr-only" aria-live="polite">
        {title}
      </p>
    </>
  )
}
