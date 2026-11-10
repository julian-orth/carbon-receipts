import { roundCo2e } from '@shared/emissions/round.ts'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import { ALTERNATIVES, type AlternativeTarget } from './alternatives'

export type MonthlyTotalRow = { month: string | null; total_co2e_kg: number | null }
export type GroupRow = {
  month: string | null
  category_group: string | null
  sum_co2e_kg: number | null
}
export type HotspotRow = {
  id: string | null
  raw_text: string | null
  quantity: number | null
  unit: EmissionUnit | null
  co2e_kg: number | null
  category_slug: string | null
  category_label: string | null
  purchased_on: string | null
}
export type FactorRef = {
  slug: string
  label: string
  unit: EmissionUnit
  co2e_per_unit: number
  source: string
  source_url: string | null
}

export type RangeMonths = 3 | 6 | 12

/** The longest selectable range; monthly figures are loaded for it once and sliced. */
export const MAX_RANGE_MONTHS: RangeMonths = 12
/** Basis of the 'average month' used to suggest a goal – independent of the chosen range. */
export const GOAL_BASIS_MONTHS = 6

/** First day of the month, as ISO date (UTC-free, local calendar). */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

/** The `count` month keys ending with the month of `today`, oldest first. */
export function lastMonths(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    monthKey(new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1)),
  )
}

const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' })

export type MonthPoint = { month: string; label: string; totalKg: number; isCurrent: boolean }

/** Monthly totals with empty months filled with 0, so gaps are visible. */
export function buildMonthSeries(
  rows: readonly MonthlyTotalRow[],
  today: Date,
  count: number,
): MonthPoint[] {
  const totals = new Map(
    rows.flatMap((r) => (r.month ? [[r.month, r.total_co2e_kg ?? 0] as const] : [])),
  )
  const current = monthKey(today)
  return lastMonths(today, count).map((month) => ({
    month,
    label: monthLabel.format(new Date(`${month}T00:00:00`)),
    totalKg: roundCo2e(totals.get(month) ?? 0),
    isCurrent: month === current,
  }))
}

/**
 * Where the running month will end if it goes on like this. Too early in the month the
 * extrapolation is noise, so there is none before day 7 (or without any data).
 */
export function projectMonth(currentKg: number, today: Date): number | null {
  const day = today.getDate()
  if (day < 7 || currentKg <= 0) return null
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return roundCo2e((currentKg / day) * daysInMonth)
}

/** Average of the completed months in the series (the running one would pull it down). */
export function averageCompletedMonth(series: readonly MonthPoint[]): number | null {
  const completed = series.filter((point) => !point.isCurrent)
  if (completed.length === 0) return null
  return roundCo2e(completed.reduce((sum, point) => sum + point.totalKg, 0) / completed.length)
}

export type ReceiptStatsInput = {
  id: string
  status: string
  purchased_at: string | null
  created_at: string
}

export type ReceiptStats = { count: number; items: number; averageKg: number | null }

/** Confirmed receipts in the range (by purchase date, upload date as fallback). */
export function receiptStats(
  receipts: readonly ReceiptStatsInput[],
  totals: ReadonlyMap<string, { itemCount: number; co2eKg: number }>,
  fromMonth: string,
): ReceiptStats {
  const inRange = receipts.filter(
    (receipt) =>
      receipt.status === 'done' &&
      (receipt.purchased_at ?? receipt.created_at.slice(0, 10)) >= fromMonth,
  )
  let items = 0
  let kg = 0
  for (const receipt of inRange) {
    const total = totals.get(receipt.id)
    items += total?.itemCount ?? 0
    kg += total?.co2eKg ?? 0
  }
  return {
    count: inRange.length,
    items,
    averageKg: inRange.length > 0 ? roundCo2e(kg / inRange.length) : null,
  }
}

export type GroupTotal = { group: string; totalKg: number; share: number }

export function sumByGroup(rows: readonly GroupRow[], fromMonth: string): GroupTotal[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (!row.month || row.month < fromMonth) continue
    const group = row.category_group ?? 'other'
    totals.set(group, (totals.get(group) ?? 0) + (row.sum_co2e_kg ?? 0))
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  return [...totals.entries()]
    .map(([group, total]) => ({
      group,
      totalKg: roundCo2e(total),
      share: sum > 0 ? total / sum : 0,
    }))
    .filter((g) => g.totalKg > 0)
    .toSorted((a, b) => b.totalKg - a.totalKg)
}

export type MonthComparison = {
  month: MonthPoint
  previous: MonthPoint
  deltaKg: number
  deltaRatio: number | null
}

/**
 * Compares the last *complete* month with the one before. Comparing the running
 * month would always look like a big drop early in the month.
 */
export function compareCompletedMonths(series: readonly MonthPoint[]): MonthComparison | null {
  const completed = series.filter((point) => !point.isCurrent)
  const month = completed.at(-1)
  const previous = completed.at(-2)
  if (!month || !previous) return null
  const deltaKg = roundCo2e(month.totalKg - previous.totalKg)
  return {
    month,
    previous,
    deltaKg,
    deltaRatio: previous.totalKg > 0 ? deltaKg / previous.totalKg : null,
  }
}

export type GoalStatus = 'on_track' | 'close' | 'over'
export type GoalProgress = { ratio: number; status: GoalStatus; remainingKg: number }

/** Share of the monthly target used so far. "close" from 80 %. */
export function goalProgress(currentKg: number, targetKg: number): GoalProgress {
  const ratio = targetKg > 0 ? currentKg / targetKg : 0
  return {
    ratio,
    status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'close' : 'on_track',
    remainingKg: roundCo2e(targetKg - currentKg),
  }
}

export type AlternativeSuggestion = {
  fromSlug: string
  fromLabel: string
  /** Category of the alternative; null for a product with its own factor. */
  toSlug: string | null
  toLabel: string
  unit: EmissionUnit
  /** kg CO2e saved per unit (kg / l / piece) */
  savingPerUnit: number
  /** Saving had the user bought the alternative instead (same amount), if computable. */
  savingKg: number | null
  source: string
  sourceUrl: string | null
}

function resolveTarget(target: AlternativeTarget, factors: ReadonlyMap<string, FactorRef>) {
  if (target.kind === 'product') {
    return {
      label: target.label,
      unit: target.unit,
      co2ePerUnit: target.co2ePerUnit,
      source: target.source,
      sourceUrl: target.sourceUrl,
    }
  }
  const factor = factors.get(target.slug)
  return factor
    ? {
        label: factor.label,
        unit: factor.unit,
        co2ePerUnit: factor.co2e_per_unit,
        source: factor.source,
        sourceUrl: factor.source_url,
      }
    : null
}

/**
 * Turns the biggest items into concrete swaps. One suggestion per category, ordered
 * by the saving for what was actually bought. Units must match – no guessing.
 */
export function suggestAlternatives(
  hotspots: readonly HotspotRow[],
  factors: readonly FactorRef[],
  limit = 3,
): AlternativeSuggestion[] {
  const bySlug = new Map(factors.map((f) => [f.slug, f]))
  const best = new Map<string, AlternativeSuggestion>()

  for (const item of hotspots) {
    if (!item.category_slug) continue
    const original = bySlug.get(item.category_slug)
    const targetDef = ALTERNATIVES[item.category_slug]
    if (!original || !targetDef) continue
    const target = resolveTarget(targetDef, bySlug)
    if (!target || target.unit !== original.unit) continue

    const savingPerUnit = roundCo2e(original.co2e_per_unit - target.co2ePerUnit)
    if (savingPerUnit <= 0) continue
    const savingKg =
      item.quantity !== null && item.unit === original.unit && item.co2e_kg !== null
        ? roundCo2e(item.co2e_kg - item.quantity * target.co2ePerUnit)
        : null

    const suggestion: AlternativeSuggestion = {
      fromSlug: original.slug,
      fromLabel: original.label,
      toSlug: targetDef.kind === 'category' ? targetDef.slug : null,
      toLabel: target.label,
      unit: original.unit,
      savingPerUnit,
      savingKg,
      source: target.source,
      sourceUrl: target.sourceUrl,
    }
    const existing = best.get(item.category_slug)
    if (!existing || (suggestion.savingKg ?? 0) > (existing.savingKg ?? 0))
      best.set(item.category_slug, suggestion)
  }

  return [...best.values()]
    .toSorted((a, b) => (b.savingKg ?? b.savingPerUnit) - (a.savingKg ?? a.savingPerUnit))
    .slice(0, limit)
}
