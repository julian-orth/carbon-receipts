import { ArrowRight, Leaf } from 'lucide-react'
import { formatCo2e } from '@/lib/format-co2'
import { UNIT_LABEL } from '@/features/review/review-logic'
import type { AlternativeSuggestion } from '../dashboard-logic'

export function AlternativesList({ suggestions }: { suggestions: AlternativeSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Für deine größten Posten haben wir gerade keinen gleichwertigen Tausch – gut so.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {suggestions.map((s) => (
        <li key={`${s.fromLabel}-${s.toLabel}`} className="rounded-lg border p-3">
          <p className="flex flex-wrap items-center gap-1 font-medium">
            <Leaf aria-hidden className="size-4 text-[var(--status-good)]" />
            {s.fromLabel}
            <ArrowRight aria-label="ersetzen durch" className="size-4" />
            {s.toLabel}
          </p>
          <p className="mt-1 text-sm">
            {s.savingKg !== null ? (
              <>
                Bei deinem Einkauf hätte das <strong>{formatCo2e(s.savingKg)}</strong> gespart
              </>
            ) : (
              <>Spart {formatCo2e(s.savingPerUnit)}</>
            )}{' '}
            <span className="text-muted-foreground">
              ({formatCo2e(s.savingPerUnit)} pro {UNIT_LABEL[s.unit]})
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quelle:{' '}
            {s.sourceUrl ? (
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {s.source}
              </a>
            ) : (
              s.source
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}
