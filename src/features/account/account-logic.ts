import type { Receipt } from '@/features/receipts/types'

/** One or two letters for the avatar: from the display name, else from the e-mail address. */
export function initialsOf(displayName: string | null | undefined, email: string | undefined) {
  const name = displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''
    return (first + last).toLocaleUpperCase('de')
  }
  return (email?.trim()[0] ?? '?').toLocaleUpperCase('de')
}

export type AccountStats = {
  receipts: number
  confirmed: number
  inReview: number
  failed: number
  items: number
  co2eKg: number
}

/** Counts for the account page; CO₂e and items only from confirmed receipts, like the dashboard. */
export function accountStats(
  receipts: readonly Pick<Receipt, 'id' | 'status'>[],
  totals: ReadonlyMap<string, { itemCount: number; co2eKg: number }>,
): AccountStats {
  const stats: AccountStats = {
    receipts: receipts.length,
    confirmed: 0,
    inReview: 0,
    failed: 0,
    items: 0,
    co2eKg: 0,
  }
  for (const receipt of receipts) {
    if (receipt.status === 'review') stats.inReview += 1
    if (receipt.status === 'failed') stats.failed += 1
    if (receipt.status !== 'done') continue
    stats.confirmed += 1
    const total = totals.get(receipt.id)
    stats.items += total?.itemCount ?? 0
    stats.co2eKg += total?.co2eKg ?? 0
  }
  return stats
}

export type QuotaUsage = { used: number; quota: number; remaining: number; ratio: number }

export function quotaUsage(used: number, quota: number): QuotaUsage {
  const remaining = Math.max(0, quota - used)
  return { used, quota, remaining, ratio: quota > 0 ? Math.min(1, used / quota) : 1 }
}

/** What the user may take with them (Art. 20 GDPR): everything stored about them, as JSON. */
export function buildExport(input: {
  exportedAt: Date
  email: string | undefined
  profile: { display_name: string | null; created_at: string } | null
  receipts: readonly unknown[]
  lineItems: readonly unknown[]
  goals: readonly unknown[]
}) {
  return {
    exported_at: input.exportedAt.toISOString(),
    account: {
      email: input.email ?? null,
      display_name: input.profile?.display_name ?? null,
      created_at: input.profile?.created_at ?? null,
    },
    receipts: input.receipts,
    line_items: input.lineItems,
    goals: input.goals,
  }
}

/** Display names are optional and short; null clears the name. */
export function parseDisplayName(
  value: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (trimmed.length > 80) return { ok: false, error: 'Der Name darf höchstens 80 Zeichen haben.' }
  return { ok: true, value: trimmed === '' ? null : trimmed }
}
