import { describe, expect, it } from 'vitest'
import { failureHelp, noteHelp } from './failure'

// The codes the edge function writes (`receipts_error_code_check`).
const DB_CODES = [
  'not_a_receipt',
  'unreadable',
  'cut_off',
  'no_items',
  'quota',
  'ai_unavailable',
  'no_file',
  'unknown',
]
const DB_NOTES = ['cut_off', 'unreadable', 'multiple_receipts', 'foreign_currency', 'non_food_only']

describe('failureHelp', () => {
  it.each(DB_CODES)('has concrete help for %s', (code) => {
    const help = failureHelp(code)
    expect(help.title).not.toBe('')
    expect(help.tips.length).toBeGreaterThan(0)
    // Every failure has a way forward.
    expect(help.canRetry || help.canUploadNew || code === 'quota').toBe(true)
  })

  it('suggests a new photo, not a retry, when the photo is the problem', () => {
    for (const code of ['not_a_receipt', 'unreadable', 'cut_off', 'no_items']) {
      expect(failureHelp(code)).toMatchObject({ canRetry: false, canUploadNew: true })
    }
  })

  it('suggests a retry when the service is the problem', () => {
    expect(failureHelp('ai_unavailable')).toMatchObject({ canRetry: true, canUploadNew: false })
  })

  it('falls back to the generic help for old receipts without a code', () => {
    expect(failureHelp(null)).toEqual(failureHelp('unknown'))
    expect(failureHelp('something-new')).toEqual(failureHelp('unknown'))
  })
})

describe('noteHelp', () => {
  it('describes every note the database allows', () => {
    expect(noteHelp(DB_NOTES)).toHaveLength(DB_NOTES.length)
  })

  it('skips unknown notes and keeps the order', () => {
    expect(noteHelp(['foreign_currency', 'nope', 'cut_off']).map((n) => n.title)).toEqual([
      'Der Bon ist nicht in Euro',
      'Der Bon wirkt abgeschnitten',
    ])
  })
})
