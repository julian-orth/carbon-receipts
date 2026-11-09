import { describe, expect, it } from 'vitest'
import {
  averageCompletedMonth,
  buildMonthSeries,
  compareCompletedMonths,
  type FactorRef,
  goalProgress,
  type HotspotRow,
  lastMonths,
  projectMonth,
  receiptStats,
  sumByGroup,
  suggestAlternatives,
} from './dashboard-logic'

const today = new Date(2026, 10, 7) // 7 Nov 2026

describe('lastMonths', () => {
  it('returns the months ending with the current one, across a year boundary', () => {
    expect(lastMonths(new Date(2026, 1, 15), 4)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ])
  })
})

describe('buildMonthSeries', () => {
  it('fills empty months with 0 and marks the current month', () => {
    const series = buildMonthSeries(
      [
        { month: '2026-09-01', total_co2e_kg: 12.5 },
        { month: '2026-11-01', total_co2e_kg: 3.25 },
        { month: '2025-01-01', total_co2e_kg: 99 }, // outside the range
      ],
      today,
      3,
    )
    expect(series.map(({ month, totalKg, isCurrent }) => ({ month, totalKg, isCurrent }))).toEqual([
      { month: '2026-09-01', totalKg: 12.5, isCurrent: false },
      { month: '2026-10-01', totalKg: 0, isCurrent: false },
      { month: '2026-11-01', totalKg: 3.25, isCurrent: true },
    ])
    expect(series[2]?.label).toBe('Nov. 26')
  })
})

describe('sumByGroup', () => {
  it('sums groups from a start month and sorts by size', () => {
    const groups = sumByGroup(
      [
        { month: '2026-08-01', category_group: 'meat_fish', sum_co2e_kg: 100 },
        { month: '2026-10-01', category_group: 'meat_fish', sum_co2e_kg: 6 },
        { month: '2026-11-01', category_group: 'meat_fish', sum_co2e_kg: 2 },
        { month: '2026-11-01', category_group: 'dairy_eggs', sum_co2e_kg: 2 },
        { month: '2026-11-01', category_group: null, sum_co2e_kg: 0 },
      ],
      '2026-10-01',
    )
    expect(groups).toEqual([
      { group: 'meat_fish', totalKg: 8, share: 0.8 },
      { group: 'dairy_eggs', totalKg: 2, share: 0.2 },
    ])
  })
})

describe('compareCompletedMonths', () => {
  it('compares the last complete month with the one before, ignoring the running month', () => {
    const series = buildMonthSeries(
      [
        { month: '2026-09-01', total_co2e_kg: 20 },
        { month: '2026-10-01', total_co2e_kg: 15 },
        { month: '2026-11-01', total_co2e_kg: 2 },
      ],
      today,
      3,
    )
    expect(compareCompletedMonths(series)).toMatchObject({
      month: { month: '2026-10-01', totalKg: 15 },
      previous: { month: '2026-09-01', totalKg: 20 },
      deltaKg: -5,
      deltaRatio: -0.25,
    })
  })

  it('has no ratio when the month before is empty', () => {
    const series = buildMonthSeries([{ month: '2026-10-01', total_co2e_kg: 15 }], today, 3)
    expect(compareCompletedMonths(series)?.deltaRatio).toBeNull()
  })

  it('needs two complete months', () => {
    expect(compareCompletedMonths(buildMonthSeries([], today, 2))).toBeNull()
  })
})

const point = (totalKg: number, isCurrent = false) => ({
  month: 'm',
  label: 'l',
  totalKg,
  isCurrent,
})
const receipt = (id: string, status: string, purchased_at: string | null) => ({
  id,
  status,
  purchased_at,
  created_at: '2026-11-01T10:00:00Z',
})

describe('projectMonth', () => {
  it('extrapolates the running month from day 7 on', () => {
    // 9 Nov: 18 kg in 9 days → 2 kg/day × 30 days
    expect(projectMonth(18, new Date(2026, 10, 9))).toBe(60)
    expect(projectMonth(18, new Date(2026, 10, 6))).toBeNull()
    expect(projectMonth(0, new Date(2026, 10, 20))).toBeNull()
  })
})

describe('averageCompletedMonth', () => {
  it('ignores the running month', () => {
    expect(averageCompletedMonth([point(10), point(20), point(3, true)])).toBe(15)
    expect(averageCompletedMonth([point(3, true)])).toBeNull()
  })
})

describe('receiptStats', () => {
  it('counts confirmed receipts in the range with their items and average', () => {
    const totals = new Map([
      ['a', { itemCount: 4, co2eKg: 6 }],
      ['b', { itemCount: 2, co2eKg: 2 }],
      ['old', { itemCount: 9, co2eKg: 90 }],
    ])
    expect(
      receiptStats(
        [
          receipt('a', 'done', '2026-10-03'),
          receipt('b', 'done', null),
          receipt('open', 'review', '2026-10-04'),
          receipt('old', 'done', '2026-01-02'),
        ],
        totals,
        '2026-06-01',
      ),
    ).toEqual({ count: 2, items: 6, averageKg: 4 })
    expect(receiptStats([], totals, '2026-06-01').averageKg).toBeNull()
  })
})

describe('goalProgress', () => {
  it.each([
    [40, 100, 'on_track'],
    [80, 100, 'close'],
    [100, 100, 'close'],
    [101, 100, 'over'],
  ] as const)('%d of %d → %s', (current, target, status) => {
    expect(goalProgress(current, target).status).toBe(status)
  })

  it('reports the remaining budget', () => {
    expect(goalProgress(30.5, 50)).toMatchObject({ ratio: 0.61, remainingKg: 19.5 })
  })
})

const hotspot = (overrides: Partial<HotspotRow>): HotspotRow => ({
  id: crypto.randomUUID(),
  raw_text: 'x',
  quantity: null,
  unit: null,
  co2e_kg: null,
  category_slug: null,
  category_label: null,
  purchased_on: '2026-11-01',
  ...overrides,
})

describe('suggestAlternatives', () => {
  const factors: FactorRef[] = [
    {
      slug: 'ground-beef',
      label: 'Rinderhackfleisch',
      unit: 'kg',
      co2e_per_unit: 9.2,
      source: 'ifeu Tab. 3 Nr. 16',
      source_url: null,
    },
    {
      slug: 'veggie-patty',
      label: 'Veggie-Burger & Bratlinge',
      unit: 'kg',
      co2e_per_unit: 1.1,
      source: 'ifeu Tab. 3 Nr. 1',
      source_url: null,
    },
    {
      slug: 'milk',
      label: 'Milch',
      unit: 'l',
      co2e_per_unit: 1.4,
      source: 'ifeu Tab. 2 Nr. 16',
      source_url: null,
    },
    {
      slug: 'oat-drink',
      label: 'Haferdrink',
      unit: 'l',
      co2e_per_unit: 0.3,
      source: 'ifeu Tab. 2 Nr. 22',
      source_url: null,
    },
    {
      slug: 'cheese',
      label: 'Käse',
      unit: 'kg',
      co2e_per_unit: 5.7,
      source: 'ifeu Tab. 2 Nr. 8',
      source_url: null,
    },
    {
      slug: 'apples',
      label: 'Äpfel',
      unit: 'kg',
      co2e_per_unit: 0.3,
      source: 'ifeu Tab. 1 Nr. 5',
      source_url: null,
    },
  ]
  it('computes the saving for the actual purchase and per unit', () => {
    const [suggestion] = suggestAlternatives(
      [hotspot({ category_slug: 'ground-beef', quantity: 0.5, unit: 'kg', co2e_kg: 4.6 })],
      factors,
    )
    expect(suggestion).toEqual({
      fromSlug: 'ground-beef',
      fromLabel: 'Rinderhackfleisch',
      toSlug: 'veggie-patty',
      toLabel: 'Veggie-Burger & Bratlinge',
      unit: 'kg',
      savingPerUnit: 8.1,
      savingKg: 4.05,
      source: 'ifeu Tab. 3 Nr. 1',
      sourceUrl: null,
    })
  })

  it('supports product alternatives with their own factor', () => {
    const [suggestion] = suggestAlternatives(
      [hotspot({ category_slug: 'cheese', quantity: 0.2, unit: 'kg', co2e_kg: 1.14 })],
      factors,
    )
    expect(suggestion).toMatchObject({
      toLabel: 'Veganer Käse-Ersatz',
      savingPerUnit: 3.7,
      savingKg: 0.74,
    })
  })

  it('orders by saving, keeps one per category and limits the result', () => {
    const suggestions = suggestAlternatives(
      [
        hotspot({ category_slug: 'milk', quantity: 1, unit: 'l', co2e_kg: 1.4 }),
        hotspot({ category_slug: 'ground-beef', quantity: 0.25, unit: 'kg', co2e_kg: 2.3 }),
        hotspot({ category_slug: 'ground-beef', quantity: 1, unit: 'kg', co2e_kg: 9.2 }),
        hotspot({ category_slug: 'apples', quantity: 1, unit: 'kg', co2e_kg: 0.3 }),
      ],
      factors,
      2,
    )
    expect(suggestions.map((s) => [s.fromLabel, s.savingKg])).toEqual([
      ['Rinderhackfleisch', 8.1],
      ['Milch', 1.1],
    ])
  })

  it('leaves the purchase saving empty when the amount is unknown', () => {
    const [suggestion] = suggestAlternatives(
      [hotspot({ category_slug: 'milk', co2e_kg: 1.4 })],
      factors,
    )
    expect(suggestion).toMatchObject({ savingPerUnit: 1.1, savingKg: null })
  })
})
