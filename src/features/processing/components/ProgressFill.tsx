import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

type ProgressFillProps = {
  /** Progress that is certain (0–1). */
  value: number
  /** While a step runs, the fill creeps towards this value, slowing down – never faking "done". */
  creepTo?: number
  creepMs?: number
  className?: string
  children?: ReactNode
}

const SETTLE_MS = 350
const translate = (progress: number) => `translateX(${((progress - 1) * 100).toFixed(3)}%)`

/** Where the element is right now, including a running animation. */
function currentProgress(element: HTMLElement): number | null {
  const width = element.offsetWidth
  if (!width || typeof DOMMatrixReadOnly === 'undefined') return null
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
  return matrix.m41 / width + 1
}

/**
 * A full-size layer that slides in from the left (transform only, so it stays on the
 * compositor). Used for the step segments and the full-screen background.
 */
export function ProgressFill({
  value,
  creepTo = value,
  creepMs = 0,
  className,
  children,
}: ProgressFillProps) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const end = Math.max(value, creepTo)
    const creeps = creepTo > value && creepMs > 0
    element.style.transform = translate(end)

    if (typeof element.animate !== 'function' || prefersReducedMotion()) {
      last.current = end
      return undefined
    }
    const from = last.current
    const total = SETTLE_MS + (creeps ? creepMs : 0)
    const animation = element.animate(
      creeps
        ? [
            { transform: translate(from), easing: 'cubic-bezier(.2,.7,.2,1)' },
            {
              transform: translate(value),
              offset: SETTLE_MS / total,
              easing: 'cubic-bezier(.05,.6,.15,1)',
            },
            { transform: translate(creepTo) },
          ]
        : [
            { transform: translate(from), easing: 'cubic-bezier(.2,.7,.2,1)' },
            { transform: translate(value) },
          ],
      { duration: total, fill: 'forwards' },
    )
    return () => {
      last.current = currentProgress(element) ?? end
      animation.cancel()
    }
  }, [value, creepTo, creepMs])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ transform: translate(0) }}
      className={cn('absolute inset-0 will-change-transform', className)}
    >
      {children}
    </div>
  )
}
