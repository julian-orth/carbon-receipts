import { describe, expect, it } from 'vitest'
import { receiptFixture } from './test-fixtures'
import { applyReceiptChange } from './realtime'

const older = receiptFixture({ id: 'a', created_at: '2026-11-01T10:00:00Z', status: 'pending' })
const newer = receiptFixture({ id: 'b', created_at: '2026-11-05T10:00:00Z' })

describe('applyReceiptChange', () => {
  it('leaves an uncached list alone', () => {
    expect(applyReceiptChange(undefined, { eventType: 'DELETE', id: 'a' })).toBeUndefined()
  })

  it('updates a receipt in place', () => {
    const updated = { ...older, status: 'processing' as const }
    expect(applyReceiptChange([newer, older], { eventType: 'UPDATE', receipt: updated })).toEqual([
      newer,
      updated,
    ])
  })

  it('inserts new receipts sorted by newest first', () => {
    const newest = receiptFixture({ id: 'c', created_at: '2026-11-07T10:00:00Z' })
    expect(
      applyReceiptChange([newer, older], { eventType: 'INSERT', receipt: newest })?.map(
        (r) => r.id,
      ),
    ).toEqual(['c', 'b', 'a'])
  })

  it('does not duplicate a receipt that is already cached', () => {
    expect(applyReceiptChange([newer], { eventType: 'INSERT', receipt: newer })).toHaveLength(1)
  })

  it('removes deleted receipts', () => {
    expect(applyReceiptChange([newer, older], { eventType: 'DELETE', id: 'b' })).toEqual([older])
  })
})
