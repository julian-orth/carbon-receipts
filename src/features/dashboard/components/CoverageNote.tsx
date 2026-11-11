import { Link } from 'react-router'
import type { Coverage } from '../dashboard-logic'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

/**
 * The honest limit of the numbers: the factor table covers food, drinks, pet food and fuel,
 * so everything else on a receipt (cosmetics, household goods) is not part of the sum.
 */
export function CoverageNote({
  coverage,
  examples,
}: {
  coverage: Coverage
  examples: readonly string[]
}) {
  if (coverage.ratio === null) return null
  const share = Math.round(coverage.ratio * 100)
  return (
    <section aria-labelledby="coverage-title" className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 id="coverage-title" className="text-base font-semibold tracking-tight">
        Abdeckung
      </h2>
      <p className="mt-2 text-sm">
        <span className="font-semibold tabular">
          {coverage.counted.toLocaleString('de-DE')} von {coverage.items.toLocaleString('de-DE')}
        </span>{' '}
        Positionen sind berechnet ({percent.format(coverage.ratio)}).
      </p>
      <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-success" style={{ width: `${share}%` }} />
      </div>
      {coverage.missing > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {coverage.missing === 1
            ? '1 Position hat'
            : `${coverage.missing.toLocaleString('de-DE')} Positionen haben`}{' '}
          keinen Wert und {coverage.missing === 1 ? 'fehlt' : 'fehlen'} in der Summe
          {examples.length > 0 && <>, zum Beispiel {examples.join(', ')}</>}. Die{' '}
          <Link to="/datenbasis" className="underline underline-offset-4">
            Datenbasis
          </Link>{' '}
          kennt Lebensmittel, Getränke, Tierfutter und Kraftstoff.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Jede bestätigte Position fließt in die Summe ein.
        </p>
      )}
    </section>
  )
}
