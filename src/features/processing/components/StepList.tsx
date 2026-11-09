import { Check, LoaderCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS } from '../steps'

type StepState = 'done' | 'active' | 'error' | 'pending'

const STATE_TEXT: Record<StepState, string> = {
  done: 'erledigt',
  active: 'läuft',
  error: 'fehlgeschlagen',
  pending: 'ausstehend',
}

type StepListProps = {
  step: number
  failed: boolean
  waiting: boolean
}

/** The five steps, top to bottom; the running one explains itself. */
export function StepList({ step, failed, waiting }: StepListProps) {
  return (
    <ol aria-label="Verarbeitungsschritte" className="flex flex-col">
      {STEPS.map((definition, index) => {
        const state: StepState =
          index < step ? 'done' : index === step ? (failed ? 'error' : 'active') : 'pending'
        const last = index === STEPS.length - 1
        return (
          <li
            key={definition.label}
            aria-current={state === 'active' || state === 'error' ? 'step' : undefined}
            className="relative flex gap-3.5 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-9 bottom-1 left-[15px] w-0.5 rounded-full transition-colors duration-500',
                  state === 'done' ? 'bg-foreground' : 'bg-border',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative grid size-8 shrink-0 place-items-center rounded-full text-sm font-medium transition-colors duration-300',
                state === 'done' && 'bg-foreground text-background',
                state === 'active' && 'bg-brand text-brand-foreground ring-4 ring-brand/30',
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
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
              <p className="text-[15px] leading-5">
                <span className="sr-only">
                  {definition.label}: {STATE_TEXT[state]}
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
              </p>
              {state === 'active' && !waiting && (
                <p className="animate-rise text-sm leading-relaxed text-muted-foreground">
                  {definition.hint}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
