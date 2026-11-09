import { Check, LoaderCircle, X } from 'lucide-react'
import type * as React from 'react'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { type Visit } from '../progress'
import type { StoryTag } from '../story'
import { formatSeconds, STEPS, type StepKind } from '../steps'

type StepState = 'done' | 'active' | 'error' | 'pending'

const STATE_TEXT: Record<StepState, string> = {
  done: 'erledigt',
  active: 'läuft',
  error: 'fehlgeschlagen',
  pending: 'ausstehend',
}

export function KindTag({
  kind,
  className,
  ...props
}: { kind: StepKind; className?: string } & React.AriaAttributes) {
  return (
    <span
      {...props}
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium tracking-wider',
        kind === 'KI' ? 'bg-brand text-brand-foreground' : 'border text-muted-foreground',
        className,
      )}
    >
      {kind}
    </span>
  )
}

/** Running seconds since `since` (ms relative to `origin`); only this text re-renders. */
function Ticker({ since, origin }: { since: number; origin: number }) {
  const now = useNow(100)
  return <>{formatSeconds(now - origin - since)}</>
}

function stepDuration(visits: readonly Visit[], step: number): number | null {
  const index = visits.findLastIndex((visit) => visit.step === step)
  const next = visits[index + 1]
  const visit = visits[index]
  return visit && next ? next.at - visit.at : null
}

const TAG_TONE: Record<NonNullable<StoryTag['tone']> | 'neutral', string> = {
  brand: 'bg-brand text-brand-foreground',
  warn: 'bg-warning-soft text-warning-foreground',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

type StepListProps = {
  step: number
  failed: boolean
  waiting: boolean
  visits: readonly Visit[]
  origin: number
  /** Details of the running step (provider, fallback …). */
  tags: readonly StoryTag[]
}

/** The five steps, top to bottom, with state, kind (KI/Code) and measured duration. */
export function StepList({ step, failed, waiting, visits, origin, tags }: StepListProps) {
  return (
    <ol aria-label="Verarbeitungsschritte" className="flex flex-col">
      {STEPS.map((definition, index) => {
        const state: StepState =
          index < step ? 'done' : index === step ? (failed ? 'error' : 'active') : 'pending'
        const duration = state === 'done' ? stepDuration(visits, index) : null
        const since = visits.findLast((visit) => visit.step === index)?.at
        const last = index === STEPS.length - 1
        return (
          <li
            key={definition.label}
            aria-current={state === 'active' || state === 'error' ? 'step' : undefined}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-8 bottom-0 left-[13px] w-0.5 rounded-full transition-colors duration-500',
                  state === 'done' ? 'bg-foreground' : 'bg-border',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs transition-colors duration-300',
                state === 'done' && 'bg-foreground text-background',
                state === 'active' && 'bg-brand text-brand-foreground',
                state === 'error' && 'bg-destructive text-white',
                state === 'pending' && 'border bg-card text-muted-foreground',
              )}
            >
              {state === 'done' && <Check className="size-4 animate-pop" strokeWidth={2.5} />}
              {state === 'active' &&
                (waiting ? (
                  index + 1
                ) : (
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                ))}
              {state === 'error' && <X className="size-4" strokeWidth={2.5} />}
              {state === 'pending' && index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
              <p className="flex items-center gap-2 text-sm leading-5">
                <span className="sr-only">
                  {definition.label} ({definition.kind}): {STATE_TEXT[state]}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-medium',
                    state === 'pending' && 'text-muted-foreground',
                    state === 'error' && 'text-destructive',
                  )}
                >
                  {definition.label}
                </span>
                <KindTag kind={definition.kind} aria-hidden />
                <span className="ml-auto font-mono text-xs text-muted-foreground tabular">
                  {duration !== null && formatSeconds(duration)}
                  {state === 'active' && !waiting && since !== undefined && (
                    <Ticker since={since} origin={origin} />
                  )}
                </span>
              </p>
              {(state === 'active' || state === 'error') && tags.length > 0 && (
                <ul className="flex animate-rise flex-wrap gap-1.5" aria-label="Details">
                  {tags.map((tag) => (
                    <li
                      key={tag.text}
                      className={cn(
                        'rounded-full px-2.5 py-1 font-mono text-[11px]',
                        TAG_TONE[tag.tone ?? 'neutral'],
                      )}
                    >
                      {tag.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
