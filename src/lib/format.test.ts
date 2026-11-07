import { describe, expect, it } from 'vitest'
import { formatDate, formatFileSize } from './format'

describe('formatDate', () => {
  it('formats in German', () => {
    expect(formatDate('2026-11-07')).toBe('07.11.2026')
  })
})

describe('formatFileSize', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [10 * 1024 * 1024, '10 MB'],
    [1.5 * 1024 * 1024, '1,5 MB'],
  ])('%d bytes → %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})
