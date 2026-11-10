import { formatDate } from '@/lib/format'
import { ACCURACY, type AccuracyReport, formatAccuracy, hasMeasurements } from './accuracy'

/** How well the AI reads real receipts; honest "not measured yet" until the numbers are entered. */
export function AccuracyCard({ report = ACCURACY }: { report?: AccuracyReport }) {
  const measured = hasMeasurements(report)
  return (
    <section aria-labelledby="accuracy-title" className="space-y-4">
      <div>
        <h2 id="accuracy-title" className="text-lg font-semibold tracking-tight">
          Wie genau liest die KI?
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {measured && report.receipts
            ? `Von Hand geprüft an ${report.receipts} echten Belegen${report.measuredOn ? ` (Stand ${formatDate(report.measuredOn)})` : ''}.`
            : 'Die Messung an echten Belegen steht noch aus. Sobald sie fertig ist, stehen die Werte hier.'}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.metrics.map((metric) => {
          const value = formatAccuracy(metric.value)
          return (
            <div key={metric.id} className="rounded-2xl border bg-card p-4">
              <dt className="text-sm font-medium">{metric.label}</dt>
              <dd className="mt-2">
                {value ? (
                  <span className="font-mono text-2xl font-semibold tracking-tight">{value}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">noch nicht gemessen</span>
                )}
                <span className="mt-2 block text-xs text-muted-foreground">
                  {metric.description}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
