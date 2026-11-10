/**
 * How well the AI reads real receipts – measured by hand, entered here.
 *
 * Fill in after testing: set `receipts` and `measuredOn`, and a `value` (0 to 1) per metric.
 * Everything stays "noch nicht gemessen" until then; nothing on the page is made up.
 * Method (README → Accuracy): every receipt is checked line by line against the paper bon.
 */
type AccuracyMetric = {
  id: 'items' | 'category' | 'quantity' | 'total'
  label: string
  /** What exactly is counted, in one sentence. */
  description: string
  /** Share from 0 to 1, or null while not measured. */
  value: number | null
}

export type AccuracyReport = {
  /** Number of real receipts in the test set. */
  receipts: number | null
  /** ISO date of the measurement, e.g. "2026-12-01". */
  measuredOn: string | null
  metrics: AccuracyMetric[]
}

export const ACCURACY: AccuracyReport = {
  receipts: null,
  measuredOn: null,
  metrics: [
    {
      id: 'items',
      label: 'Positionen erkannt',
      description: 'Anteil der Artikelzeilen auf dem Bon, die gefunden wurden.',
      value: null,
    },
    {
      id: 'category',
      label: 'Kategorie stimmt',
      description: 'Anteil der erkannten Positionen, deren Kategorie ohne Korrektur richtig war.',
      value: null,
    },
    {
      id: 'quantity',
      label: 'Menge stimmt',
      description: 'Anteil der Positionen mit richtiger Menge (vom Bon oder passend geschätzt).',
      value: null,
    },
    {
      id: 'total',
      label: 'CO₂-Summe nah dran',
      description:
        'Anteil der Belege, deren Summe höchstens 10 % von der von Hand geprüften abweicht.',
      value: null,
    },
  ],
}

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

/** "92 %", or null while there is no measurement (a value outside 0–1 counts as none). */
export function formatAccuracy(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1) return null
  return percent.format(value)
}

/** True once at least one metric has a valid value. */
export function hasMeasurements(report: AccuracyReport): boolean {
  return report.metrics.some((metric) => formatAccuracy(metric.value) !== null)
}
