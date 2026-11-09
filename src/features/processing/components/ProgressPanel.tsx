import { Clock, ScanLine } from 'lucide-react'
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
  /** Status headline of the right column ("Bon wird gelesen …", "Fertig! …"). */
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
 * Shared body of the progress dialogs (upload and analysis): a header with the file and a
 * hairline progress, the receipt filling up on the left, status and steps on the right.
 * On phones the receipt sits below the status.
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
  const shownStep = Math.min(step, ALL_DONE - 1) + 1

  return (
    <>
      <header className="relative flex shrink-0 items-center gap-3 border-b py-3.5 pr-16 pl-5 md:pl-6">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground"
        >
          <ScanLine className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="text-[15px] leading-5 font-semibold">
            Beleg analysieren
          </DialogTitle>
          {fileName && <p className="truncate text-xs text-muted-foreground">{fileName}</p>}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums max-sm:hidden">
          {failed
            ? 'Abgebrochen'
            : done
              ? 'Abgeschlossen'
              : `Schritt ${shownStep} von ${STEPS.length}`}
        </p>
        {/* Hairline progress along the header's edge. */}
        <div aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 overflow-hidden">
          <ProgressFill
            value={overall}
            creepTo={running ? (step + 0.9) / ALL_DONE : undefined}
            creepMs={running ? (CREEP_MS[step] ?? 0) : 0}
            className={cn(
              'transition-colors duration-500',
              failed ? 'bg-destructive' : done ? 'bg-success' : 'bg-primary',
            )}
          />
        </div>
      </header>

      {/* Scrolls as a whole on phones, so it must be reachable by keyboard there. */}
      <section
        aria-label="Fortschritt"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
        tabIndex={0}
        className="grid min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] md:overflow-hidden"
      >
        <div
          data-paper-scroll
          className="order-2 flex justify-center bg-muted px-5 py-7 md:order-1 md:items-start md:overflow-y-auto md:px-10 md:py-9"
        >
          {paper}
        </div>

        <div className="order-1 flex flex-col gap-6 px-5 pt-5 pb-6 md:order-2 md:overflow-y-auto md:border-l md:px-7 md:pt-7">
          <div className="flex flex-col gap-2">
            <h3
              key={title}
              className={cn(
                'animate-rise text-xl leading-snug font-semibold tracking-tight text-balance',
                failed && 'text-destructive',
              )}
            >
              {title}
            </h3>
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
                : `Schritt ${shownStep} von ${STEPS.length} · ${STEPS[step]?.label ?? ''}`}
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

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-card px-5 py-3.5 md:px-6">
        {actions}
      </footer>

      <p className="sr-only" aria-live="polite">
        {title}
      </p>
    </>
  )
}
