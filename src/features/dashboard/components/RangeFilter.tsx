import { Button } from '@/components/ui/button'
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
    <fieldset className="inline-flex rounded-lg border p-0.5">
      <legend className="sr-only">Zeitraum</legend>
      {OPTIONS.map((months) => (
        <Button
          key={months}
          size="sm"
          variant={months === value ? 'secondary' : 'ghost'}
          aria-pressed={months === value}
          onClick={() => onChange(months)}
        >
          {months} Monate
        </Button>
      ))}
    </fieldset>
  )
}
