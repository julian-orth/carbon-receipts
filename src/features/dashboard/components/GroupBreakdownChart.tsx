import { GROUP_LABEL } from '@/features/categories/categories'
import { formatCo2e } from '@/lib/format-co2'
import type { GroupTotal } from '../dashboard-logic'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

/**
 * Horizontal bars as plain HTML: six sorted magnitudes don't need an SVG chart.
 * Every bar is labelled with its value, so the list is its own accessible table.
 */
export function GroupBreakdownChart({ groups }: { groups: GroupTotal[] }) {
  const max = Math.max(...groups.map((g) => g.totalKg), 0.0001)
  return (
    <ul className="space-y-3">
      {groups.map((group) => {
        const label = GROUP_LABEL[group.group] ?? group.group
        return (
          <li key={group.group} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{label}</span>
              <span className="shrink-0 tabular-nums">
                {formatCo2e(group.totalKg)}{' '}
                <span className="text-muted-foreground">({percent.format(group.share)})</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-[var(--viz-series-1)]"
                style={{ width: `${(group.totalKg / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
