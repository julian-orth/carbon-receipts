import type { EmissionCategory } from '@/features/categories/categories'
import { CategoryTile } from '@/features/categories/CategoryTile'
import { formatDate } from '@/lib/format'
import { formatCo2e } from '@/lib/format-co2'
import type { HotspotRow } from '../dashboard-logic'

/** The biggest single items, ranked; bar length relative to the biggest. */
export function HotspotList({
  hotspots,
  categoriesBySlug,
}: {
  hotspots: HotspotRow[]
  categoriesBySlug: ReadonlyMap<string, EmissionCategory>
}) {
  if (hotspots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Im gewählten Zeitraum gibt es noch keine Einkäufe.
      </p>
    )
  }
  const max = Math.max(...hotspots.map((h) => h.co2e_kg ?? 0), 0.0001)
  return (
    <ol className="flex flex-col gap-4">
      {hotspots.map((item, index) => {
        const category = item.category_slug ? categoriesBySlug.get(item.category_slug) : undefined
        return (
          <li key={item.id ?? index} className="flex items-center gap-3">
            <CategoryTile category={category} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  <span className="sr-only">{index + 1}. </span>
                  <span className="font-medium">{item.raw_text}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatCo2e(item.co2e_kg ?? 0)}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-viz-bar"
                  style={{ width: `${((item.co2e_kg ?? 0) / max) * 100}%` }}
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  item.category_label,
                  item.purchased_on && `gekauft am ${formatDate(item.purchased_on)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
