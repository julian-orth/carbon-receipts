import { formatCo2e } from '@/lib/format-co2'
import type { ReceiptStats } from '../dashboard-logic'

/** Key figures of the selected range; plain text, no chart needed for three numbers. */
export function RangeStats({
  range,
  totalKg,
  stats,
}: {
  range: number
  totalKg: number
  stats: ReceiptStats
}) {
  const rows = [
    { label: `Summe, ${range} Monate`, value: formatCo2e(totalKg) },
    { label: 'Bestätigte Belege', value: stats.count.toLocaleString('de-DE') },
    { label: 'Ø pro Einkauf', value: stats.averageKg === null ? '–' : formatCo2e(stats.averageKg) },
    { label: 'Erfasste Produkte', value: stats.items.toLocaleString('de-DE') },
  ]
  return (
    <section aria-labelledby="range-stats-title" className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 id="range-stats-title" className="sr-only">
        Kennzahlen im Zeitraum
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col-reverse gap-1">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-xl font-semibold tracking-tight">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
