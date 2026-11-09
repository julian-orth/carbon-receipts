import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** Animates from the last shown value to `target`. Instant with reduced motion. */
export function useCountUp(target: number, durationMs: number): number {
  const instant =
    durationMs <= 0 || prefersReducedMotion() || typeof window.requestAnimationFrame !== 'function'
  const [value, setValue] = useState(0)
  const shown = useRef(0)

  useEffect(() => {
    if (instant) return undefined
    const from = shown.current
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      shown.current = from + (target - from) * easeOutCubic(t)
      setValue(shown.current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, instant])

  return instant ? target : value
}
