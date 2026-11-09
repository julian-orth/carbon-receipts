import { useEffect, useState } from 'react'
import type { Visit } from './progress'

type Paced = { step: number; visits: Visit[] }

/**
 * Follows `target` one step at a time; each step stays visible at least `minStepMs`.
 * Going back (a retry after a failure) is immediate. `visits` records when each step
 * became active, in ms relative to `origin`.
 */
export function usePacedStep(
  target: number,
  { initial, minStepMs, origin }: { initial: number; minStepMs: number; origin: number },
): Paced {
  const [paced, setPaced] = useState<Paced>(() => {
    const step = Math.min(initial, target)
    return { step, visits: [{ step, at: Date.now() - origin }] }
  })

  useEffect(() => {
    if (paced.step === target) return undefined
    const lastAt = paced.visits.at(-1)?.at ?? 0
    const delay = target < paced.step ? 0 : Math.max(0, origin + lastAt + minStepMs - Date.now())
    const id = setTimeout(() => {
      setPaced((prev) => {
        const step = target < prev.step ? target : prev.step + 1
        return { step, visits: [...prev.visits, { step, at: Date.now() - origin }] }
      })
    }, delay)
    return () => clearTimeout(id)
  }, [paced, target, minStepMs, origin])

  return paced
}
