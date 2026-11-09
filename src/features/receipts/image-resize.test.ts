import { describe, expect, it } from 'vitest'
import { fitWithin, MAX_DIMENSION, prepareImage } from './image-resize'

describe('fitWithin', () => {
  it.each([
    [4032, 3024, { width: 2048, height: 1536 }],
    [3024, 4032, { width: 1536, height: 2048 }],
    [1200, 800, { width: 1200, height: 800 }],
    [2048, 100, { width: 2048, height: 100 }],
  ])('%d×%d → %o', (width, height, expected) => {
    expect(fitWithin(width, height)).toEqual(expected)
  })

  it('never upscales and keeps the longest edge at the limit', () => {
    const { width, height } = fitWithin(10_000, 5_000)
    expect(Math.max(width, height)).toBe(MAX_DIMENSION)
  })
})

describe('prepareImage', () => {
  it('returns the original when the browser cannot decode images (jsdom)', async () => {
    const file = new File(['x'], 'bon.heic', { type: 'image/heic' })
    await expect(prepareImage(file)).resolves.toBe(file)
  })
})
