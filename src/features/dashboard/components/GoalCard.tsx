import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { formatCo2e } from '@/lib/format-co2'
import { parseDecimal } from '@shared/emissions/units.ts'
import { goalProgress, type GoalStatus } from '../dashboard-logic'
import type { MonthlyGoal } from '../api'
import { useSaveMonthlyGoal } from '../queries'

const STATUS: Record<GoalStatus, { label: string; icon: typeof CircleCheck; color: string }> = {
  on_track: { label: 'Im Plan', icon: CircleCheck, color: 'var(--status-good)' },
  close: { label: 'Knapp', icon: TriangleAlert, color: 'var(--status-warning)' },
  over: { label: 'Überschritten', icon: CircleAlert, color: 'var(--status-critical)' },
}

const goalSchema = z.object({
  target: z.string().refine((value) => {
    const parsed = parseDecimal(value)
    return parsed !== null && parsed > 0 && parsed <= 10_000
  }, 'Bitte einen Wert zwischen 0 und 10.000 kg eingeben.'),
})

export function GoalCard({ goal, currentKg }: { goal: MonthlyGoal | null; currentKg: number }) {
  const [editing, setEditing] = useState(goal === null)
  const save = useSaveMonthlyGoal()
  const inputId = useId()
  const errorId = useId()
  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: { target: goal ? String(goal.target_co2e_kg).replace('.', ',') : '' },
  })
  const error = form.formState.errors.target?.message

  const onSubmit = form.handleSubmit(({ target }) => {
    const targetKg = parseDecimal(target) ?? 0
    save.mutate({ targetKg, existingId: goal?.id ?? null }, { onSuccess: () => setEditing(false) })
  })

  if (editing) {
    return (
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={inputId}>Monatsziel in kg CO₂e</Label>
          <Input
            id={inputId}
            inputMode="decimal"
            placeholder="z. B. 60"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...form.register('target')}
          />
          {error && (
            <p id={errorId} className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            Ziel konnte nicht gespeichert werden.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            Ziel speichern
          </Button>
          {goal && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
          )}
        </div>
      </form>
    )
  }

  if (!goal) return null
  const target = Number(goal.target_co2e_kg)
  const progress = goalProgress(currentKg, target)
  const status = STATUS[progress.status]
  const Icon = status.icon

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums">
          {formatCo2e(currentKg)}{' '}
          <span className="text-base font-normal text-muted-foreground">
            von {formatCo2e(target)}
          </span>
        </p>
        <p className="flex items-center gap-1 text-sm font-medium">
          <Icon aria-hidden className="size-4" style={{ color: status.color }} />
          {status.label}
        </p>
      </div>
      <meter
        min={0}
        max={target}
        low={target * 0.8}
        high={target}
        optimum={0}
        value={Math.min(currentKg, target)}
        aria-label="Fortschritt Monatsziel"
        className="h-2 w-full"
      >
        {Math.round(progress.ratio * 100)} %
      </meter>
      <p className="text-sm text-muted-foreground">
        {progress.remainingKg >= 0
          ? `Noch ${formatCo2e(progress.remainingKg)} bis zum Ziel in diesem Monat.`
          : `${formatCo2e(-progress.remainingKg)} über dem Ziel.`}
      </p>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        Ziel ändern
      </Button>
    </div>
  )
}
