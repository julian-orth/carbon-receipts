import { formatDate } from '@/lib/format'
import { formatCo2e } from '@/lib/format-co2'
import type { HotspotRow } from '../dashboard-logic'

export function HotspotList({ hotspots }: { hotspots: HotspotRow[] }) {
  if (hotspots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Im gewählten Zeitraum gibt es noch keine Einkäufe.
      </p>
    )
  }
  const max = Math.max(...hotspots.map((h) => h.co2e_kg ?? 0), 0.0001)
  return (
    <ol className="space-y-3">
      {hotspots.map((item, index) => (
        <li key={item.id ?? index} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
              <span className="font-medium">{item.raw_text}</span>
              {item.category_label && (
                <span className="text-muted-foreground"> · {item.category_label}</span>
              )}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatCo2e(item.co2e_kg ?? 0)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-viz-bar"
              style={{ width: `${((item.co2e_kg ?? 0) / max) * 100}%` }}
            />
          </div>
          {item.purchased_on && (
            <p className="text-xs text-muted-foreground">
              gekauft am {formatDate(item.purchased_on)}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
