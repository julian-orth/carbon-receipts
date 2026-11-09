import { ArrowRight, Sprout } from 'lucide-react'
import type { EmissionCategory } from '@/features/categories/categories'
import { CategoryTile } from '@/features/categories/CategoryTile'
import { UNIT_LABEL } from '@/features/review/review-logic'
import { formatCo2e } from '@/lib/format-co2'
import type { AlternativeSuggestion } from '../dashboard-logic'

/** Like-for-like swaps for the biggest items, each with its saving and source. */
export function AlternativesList({
  suggestions,
  categoriesBySlug,
}: {
  suggestions: AlternativeSuggestion[]
  categoriesBySlug: ReadonlyMap<string, EmissionCategory>
}) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Für deine größten Posten haben wir gerade keinen gleichwertigen Tausch – gut so.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {suggestions.map((s) => {
        const to = s.toSlug ? categoriesBySlug.get(s.toSlug) : undefined
        return (
          <li
            key={`${s.fromLabel}-${s.toLabel}`}
            className="flex flex-col gap-2.5 rounded-2xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CategoryTile category={categoriesBySlug.get(s.fromSlug)} size="sm" />
                  {s.fromLabel}
                </span>
                <ArrowRight
                  aria-label="ersetzen durch"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                  {to ? (
                    <CategoryTile category={to} size="sm" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-success-soft text-success-foreground"
                    >
                      <Sprout className="size-4" />
                    </span>
                  )}
                  {s.toLabel}
                </span>
              </p>
              <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-success-foreground tabular-nums">
                −{formatCo2e(s.savingKg ?? s.savingPerUnit)}
                {s.savingKg === null && ` pro ${UNIT_LABEL[s.unit]}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {s.savingKg !== null && `${formatCo2e(s.savingPerUnit)} pro ${UNIT_LABEL[s.unit]} · `}
              Quelle:{' '}
              {s.sourceUrl ? (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {s.source}
                </a>
              ) : (
                s.source
              )}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
