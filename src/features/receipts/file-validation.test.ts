import { describe, expect, it } from 'vitest'
import { MAX_FILE_SIZE, validateReceiptFile } from './file-validation'

const file = (name: string, type: string, size = 1000) => ({ name, type, size })

describe('validateReceiptFile', () => {
  it.each([
    ['bon.jpg', 'image/jpeg', 'photo', 'image/jpeg', 'jpg'],
    ['bon.JPEG', '', 'photo', 'image/jpeg', 'jpg'],
    ['bon.png', 'image/png', 'photo', 'image/png', 'png'],
    ['bon.heic', '', 'photo', 'image/heic', 'heic'],
  ])('accepts %s (%s)', (name, type, sourceType, contentType, extension) => {
    expect(validateReceiptFile(file(name, type))).toEqual({
      ok: true,
      kind: { sourceType, contentType, extension },
    })
  })

  it.each([
    ['bon.pdf', 'application/pdf'],
    ['konto.csv', 'text/csv'],
    ['bon.gif', 'image/gif'],
    ['noextension', ''],
    ['script.js', 'text/javascript'],
  ])('rejects %s', (name, type) => {
    const result = validateReceiptFile(file(name, type))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/nicht unterstützt/)
  })

  it('rejects empty files', () => {
    expect(validateReceiptFile(file('bon.jpg', 'image/jpeg', 0))).toEqual({
      ok: false,
      error: 'Die Datei ist leer.',
    })
  })

  it('rejects files over the bucket limit', () => {
    const result = validateReceiptFile(file('bon.jpg', 'image/jpeg', MAX_FILE_SIZE + 1))
    expect(!result.ok && result.error).toMatch(/zu groß.*Maximal 10 MB/)
  })

  it('accepts files exactly at the limit', () => {
    expect(validateReceiptFile(file('bon.jpg', 'image/jpeg', MAX_FILE_SIZE)).ok).toBe(true)
  })
})
