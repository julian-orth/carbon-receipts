import type { RangeMonths } from '../dashboard-logic'

const OPTIONS: RangeMonths[] = [3, 6, 12]

export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeMonths
  onChange: (value: RangeMonths) => void
}) {
  return (
    <fieldset className="inline-flex rounded-full border bg-card p-1 text-sm">
      <legend className="sr-only">Zeitraum</legend>
      {OPTIONS.map((months) => (
        <button
          key={months}
          type="button"
          aria-pressed={months === value}
          onClick={() => onChange(months)}
          className="h-8 rounded-full px-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:bg-foreground aria-pressed:font-medium aria-pressed:text-background"
        >
          {months} Monate
        </button>
      ))}
    </fieldset>
  )
}
