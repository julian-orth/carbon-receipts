import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { type Visit } from '../progress'
import { formatSeconds, STEPS, type StepKind } from '../steps'
import { CREEP_MS } from '../timing'
import { ProgressFill } from './ProgressFill'

type SegmentState = 'done' | 'active' | 'error' | 'pending'

const STATE_TEXT: Record<SegmentState, string> = {
  done: 'erledigt',
  active: 'läuft',
  error: 'fehlgeschlagen',
  pending: 'ausstehend',
}

export function KindTag({ kind, className }: { kind: StepKind; className?: string }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wider',
        kind === 'KI' ? 'bg-brand/15 text-brand' : 'border border-ink-line text-ink-muted',
        className,
      )}
    >
      {kind}
    </span>
  )
}

/** Running seconds since `since` (ms relative to `origin`); only this text re-renders. */
export function Ticker({ since, origin }: { since: number; origin: number }) {
  const now = useNow(100)
  return <>{formatSeconds(now - origin - since)}</>
}

function stepDuration(visits: readonly Visit[], step: number): number | null {
  const index = visits.findLastIndex((visit) => visit.step === step)
  const next = visits[index + 1]
  const visit = visits[index]
  return visit && next ? next.at - visit.at : null
}

type StepRailProps = {
  step: number
  failed: boolean
  visits: readonly Visit[]
  origin: number
}

export function StepRail({ step, failed, visits, origin }: StepRailProps) {
  const states = STEPS.map((_, index): SegmentState => {
    if (index < step) return 'done'
    if (index === step) return failed ? 'error' : 'active'
    return 'pending'
  })
  const current = STEPS[step]

  return (
    <nav aria-label="Verarbeitungsschritte">
      <ol className="grid grid-cols-5 gap-1.5">
        {STEPS.map((definition, index) => {
          const state = states[index] ?? 'pending'
          const duration = state === 'done' ? stepDuration(visits, index) : null
          const since = visits.findLast((visit) => visit.step === index)?.at
          return (
            <li
              key={definition.label}
              aria-current={state === 'active' || state === 'error' ? 'step' : undefined}
              className="flex min-w-0 flex-col gap-3"
            >
              <div className="relative h-1.5 overflow-hidden rounded-full bg-ink-line">
                <ProgressFill
                  value={state === 'done' ? 1 : 0}
                  creepTo={state === 'active' ? 0.9 : state === 'error' ? 0.5 : undefined}
                  creepMs={state === 'active' ? CREEP_MS[index] : 0}
                  className={cn('rounded-full', state === 'error' ? 'bg-ink-danger' : 'bg-brand')}
                />
                {state === 'active' && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 animate-sweep bg-linear-to-r from-transparent via-white/50 to-transparent motion-reduce:hidden"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span
                  className={cn(
                    'font-mono tabular',
                    state === 'pending'
                      ? 'text-ink-subtle'
                      : state === 'error'
                        ? 'text-ink-danger'
                        : 'text-brand',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'hidden truncate font-medium sm:inline',
                    state === 'pending' ? 'text-ink-muted' : 'text-ink-foreground',
                  )}
                >
                  {definition.label}
                </span>
                <KindTag kind={definition.kind} className="hidden lg:inline" />
                <span className="hidden font-mono text-xs text-ink-subtle tabular md:inline">
                  {duration !== null && formatSeconds(duration)}
                  {state === 'active' && since !== undefined && (
                    <Ticker since={since} origin={origin} />
                  )}
                  {state === 'error' && 'Fehler'}
                </span>
                <span className="sr-only">
                  {definition.label} ({definition.kind}): {STATE_TEXT[state]}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      {current && (
        <p aria-hidden="true" className="mt-3 flex items-center gap-2 font-mono text-xs sm:hidden">
          <span className={failed ? 'text-ink-danger' : 'text-brand'}>
            {String(step + 1).padStart(2, '0')} {current.label}
          </span>
          <span className="text-ink-muted">· {current.kind}</span>
        </p>
      )}
    </nav>
  )
}
