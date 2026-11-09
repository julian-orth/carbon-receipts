import { cn } from '@/lib/utils'
import { STEPS } from '../steps'

/** Compact five-segment progress for lists: `step` is the running step (0-based). */
export function MiniSteps({
  step,
  running,
  className,
}: {
  step: number
  running: boolean
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('grid grid-cols-5 gap-1', className)}>
      {STEPS.map((definition, index) => (
        <div
          key={definition.label}
          className={cn(
            'relative h-1.5 overflow-hidden rounded-full',
            index < step ? 'bg-primary' : 'bg-border',
          )}
        >
          {index === step && running && (
            <>
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary" />
              <div className="absolute inset-0 animate-sweep bg-linear-to-r from-transparent via-white/80 to-transparent motion-reduce:hidden" />
            </>
          )}
        </div>
      ))}
    </div>
  )
}
