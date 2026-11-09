import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePacedStep } from './use-paced-step'

describe('usePacedStep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('walks to the target one step at a time and records when each step started', () => {
    const { result } = renderHook(() => usePacedStep(4, { initial: 1, minStepMs: 500, origin: 0 }))
    expect(result.current.step).toBe(1)

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current.step).toBe(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.step).toBe(2)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.step).toBe(4)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.step).toBe(4)
    expect(result.current.visits).toEqual([
      { step: 1, at: 0 },
      { step: 2, at: 500 },
      { step: 3, at: 1000 },
      { step: 4, at: 1500 },
    ])
  })

  it('does not delay a step that has already been visible long enough', () => {
    const { result, rerender } = renderHook(
      ({ target }) => usePacedStep(target, { initial: 1, minStepMs: 500, origin: 0 }),
      { initialProps: { target: 1 } },
    )
    act(() => {
      vi.advanceTimersByTime(3000)
    }) // the AI takes a while …
    rerender({ target: 2 })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.step).toBe(2)
  })

  it('goes back immediately on a retry', () => {
    const { result, rerender } = renderHook(
      ({ target }) => usePacedStep(target, { initial: 3, minStepMs: 500, origin: 0 }),
      { initialProps: { target: 3 } },
    )
    rerender({ target: 1 })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.step).toBe(1)
  })
})
