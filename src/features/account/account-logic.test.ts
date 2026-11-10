import { describe, expect, it } from 'vitest'
import {
  accountStats,
  buildExport,
  initialsOf,
  parseDisplayName,
  quotaUsage,
} from './account-logic'

describe('initialsOf', () => {
  it.each([
    ['Julian Orth', 'a@b.de', 'JO'],
    ['  julian  ', 'a@b.de', 'J'],
    ['Anna Maria Schmidt', 'a@b.de', 'AS'],
    [null, 'demo@carbon-receipts.app', 'D'],
    ['', 'zoe@example.com', 'Z'],
    ['ärger öfter', 'x@y.de', 'ÄÖ'],
    [null, undefined, '?'],
  ])('%s / %s → %s', (name, email, expected) => {
    expect(initialsOf(name, email)).toBe(expected)
  })
})

describe('accountStats', () => {
  const totals = new Map([
    ['a', { itemCount: 5, co2eKg: 10 }],
    ['b', { itemCount: 2, co2eKg: 4.5 }],
    ['c', { itemCount: 9, co2eKg: 99 }],
  ])

  it('counts by status and sums only confirmed receipts', () => {
    const stats = accountStats(
      [
        { id: 'a', status: 'done' },
        { id: 'b', status: 'done' },
        { id: 'c', status: 'review' },
        { id: 'd', status: 'failed' },
        { id: 'e', status: 'pending' },
      ],
      totals,
    )
    expect(stats).toEqual({
      receipts: 5,
      confirmed: 2,
      inReview: 1,
      failed: 1,
      items: 7,
      co2eKg: 14.5,
    })
  })

  it('is all zero without receipts', () => {
    expect(accountStats([], new Map())).toEqual({
      receipts: 0,
      confirmed: 0,
      inReview: 0,
      failed: 0,
      items: 0,
      co2eKg: 0,
    })
  })
})

describe('quotaUsage', () => {
  it('computes what is left and the share used', () => {
    expect(quotaUsage(5, 20)).toEqual({ used: 5, quota: 20, remaining: 15, ratio: 0.25 })
  })

  it('never goes negative or above 100 %', () => {
    expect(quotaUsage(25, 20)).toMatchObject({ remaining: 0, ratio: 1 })
  })

  it('treats a quota of 0 as used up', () => {
    expect(quotaUsage(0, 0)).toMatchObject({ remaining: 0, ratio: 1 })
  })
})

describe('buildExport', () => {
  it('bundles everything with a timestamp and tolerates a missing profile', () => {
    const bundle = buildExport({
      exportedAt: new Date('2026-11-10T12:00:00Z'),
      email: 'a@b.de',
      profile: null,
      receipts: [{ id: 1 }],
      lineItems: [{ id: 2 }, { id: 3 }],
      goals: [],
    })
    expect(bundle).toEqual({
      exported_at: '2026-11-10T12:00:00.000Z',
      account: { email: 'a@b.de', display_name: null, created_at: null },
      receipts: [{ id: 1 }],
      line_items: [{ id: 2 }, { id: 3 }],
      goals: [],
    })
  })
})

describe('parseDisplayName', () => {
  it('trims, and an empty name clears it', () => {
    expect(parseDisplayName('  Julian ')).toEqual({ ok: true, value: 'Julian' })
    expect(parseDisplayName('   ')).toEqual({ ok: true, value: null })
  })

  it('rejects more than 80 characters', () => {
    expect(parseDisplayName('x'.repeat(81))).toMatchObject({ ok: false })
    expect(parseDisplayName('x'.repeat(80))).toMatchObject({ ok: true })
  })
})
