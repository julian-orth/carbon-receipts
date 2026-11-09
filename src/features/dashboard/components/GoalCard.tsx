import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { parseDecimal } from '@shared/emissions/units.ts'
import type { MonthlyGoal } from '../api'
import { useSaveMonthlyGoal } from '../queries'

const goalSchema = z.object({
  target: z.string().refine((value) => {
    const parsed = parseDecimal(value)
    return parsed !== null && parsed > 0 && parsed <= 10_000
  }, 'Bitte einen Wert zwischen 0 und 10.000 kg eingeben.'),
})

/** Sets or changes the monthly CO₂e target. */
export function GoalForm({
  goal,
  averageKg,
  onDone,
}: {
  goal: MonthlyGoal | null
  /** Average of the completed months – a sensible first suggestion. */
  averageKg: number | null
  onDone: () => void
}) {
  const save = useSaveMonthlyGoal()
  const inputId = useId()
  const errorId = useId()
  const hintId = useId()
  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: { target: goal ? String(goal.target_co2e_kg).replace('.', ',') : '' },
  })
  const error = form.formState.errors.target?.message

  const onSubmit = form.handleSubmit(({ target }) => {
    const targetKg = parseDecimal(target) ?? 0
    save.mutate({ targetKg, existingId: goal?.id ?? null }, { onSuccess: onDone })
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Monatsziel in kg CO₂e</Label>
        <Input
          id={inputId}
          inputMode="decimal"
          placeholder="z. B. 60"
          className="h-11 text-base"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : averageKg !== null ? hintId : undefined}
          {...form.register('target')}
        />
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          averageKg !== null && (
            <p id={hintId} className="text-sm text-muted-foreground">
              Zur Orientierung: Bisher waren es im Schnitt{' '}
              {averageKg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg pro Monat.
            </p>
          )
        )}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          Ziel konnte nicht gespeichert werden.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Ziel speichern
        </Button>
      </div>
    </form>
  )
}
