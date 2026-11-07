import { zodResolver } from '@hookform/resolvers/zod'
import { Check, TriangleAlert } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { type EmissionCategory, GROUP_LABEL } from '@/features/categories'
import { formatCo2e } from '@/lib/format-co2'
import { cn } from '@/lib/utils'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import { useSaveLineItem } from '../queries'
import {
  ATTENTION_LABEL,
  attentionReasons,
  computeCo2e,
  formatQuantityInput,
  type LineItem,
  parseQuantityInput,
  UNIT_LABEL,
} from '../review-logic'

const SELECTABLE_UNITS: EmissionUnit[] = ['kg', 'l', 'piece']

const rowSchema = z.object({
  categoryId: z.string(),
  quantity: z
    .string()
    .refine(
      (value) => parseQuantityInput(value) !== undefined,
      'Bitte eine positive Zahl eingeben, z. B. 0,5',
    ),
  unit: z.enum(['', 'kg', 'l', 'piece']),
})
type RowForm = z.infer<typeof rowSchema>

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

export function LineItemRow({
  item,
  categories,
}: {
  item: LineItem
  categories: readonly EmissionCategory[]
}) {
  const save = useSaveLineItem(item.receipt_id)
  const baseId = useId()
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const groups = useMemo(() => {
    const byGroup = new Map<string, EmissionCategory[]>()
    for (const category of categories) {
      const list = byGroup.get(category.category_group) ?? []
      list.push(category)
      byGroup.set(category.category_group, list)
    }
    return [...byGroup.entries()]
  }, [categories])

  const form = useForm<RowForm>({
    resolver: zodResolver(rowSchema),
    defaultValues: {
      categoryId: item.category_id ?? '',
      quantity: formatQuantityInput(item.quantity),
      unit: item.unit === 'eur' || item.unit === null ? '' : item.unit,
    },
  })
  const values = useWatch({ control: form.control })
  const category = values.categoryId ? categoriesById.get(values.categoryId) : undefined
  const quantity = parseQuantityInput(values.quantity ?? '')
  const unit = values.unit ? (values.unit as EmissionUnit) : null
  const preview = computeCo2e(
    { categoryId: values.categoryId || null, quantity: quantity ?? null, unit, price: item.price },
    category,
  )
  const reasons = attentionReasons(item)
  const isDirty = form.formState.isDirty
  const quantityError = form.formState.errors.quantity?.message

  const onSubmit = form.handleSubmit((data) => {
    const nextQuantity = parseQuantityInput(data.quantity) ?? null
    const nextUnit = data.unit === '' ? null : data.unit
    const nextCategory = data.categoryId ? categoriesById.get(data.categoryId) : undefined
    const result = computeCo2e(
      {
        categoryId: data.categoryId || null,
        quantity: nextQuantity,
        unit: nextUnit,
        price: item.price,
      },
      nextCategory,
    )
    save.mutate(
      {
        id: item.id,
        normalizedName: item.normalized_name,
        categoryId: data.categoryId || null,
        categoryChanged: (data.categoryId || null) !== item.category_id,
        quantity: nextQuantity,
        unit: nextUnit,
        co2eKg: result.ok ? result.co2eKg : null,
      },
      { onSuccess: () => form.reset(data) },
    )
  })

  return (
    <li
      className={cn(
        'rounded-lg border p-4',
        reasons.length > 0 && 'border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20',
      )}
    >
      <form onSubmit={onSubmit} aria-labelledby={`${baseId}-title`} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id={`${baseId}-title`} className="font-medium">
              {item.raw_text}
            </h3>
            {item.price !== null && (
              <p className="text-sm text-muted-foreground">
                {item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason) => (
              <Badge key={reason} variant="outline" className="border-amber-500/60">
                <TriangleAlert aria-hidden />
                {ATTENTION_LABEL[reason]}
              </Badge>
            ))}
            {item.reviewed && !isDirty && (
              <Badge variant="secondary">
                <Check aria-hidden />
                Geprüft
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-1">
            <Label htmlFor={`${baseId}-category`}>Kategorie</Label>
            <select
              id={`${baseId}-category`}
              className={selectClass}
              {...form.register('categoryId')}
            >
              <option value="">– keine passende –</option>
              {groups.map(([group, list]) => (
                <optgroup key={group} label={GROUP_LABEL[group] ?? group}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${baseId}-quantity`}>Menge</Label>
            <Input
              id={`${baseId}-quantity`}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={quantityError ? true : undefined}
              aria-describedby={quantityError ? `${baseId}-quantity-error` : undefined}
              {...form.register('quantity')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${baseId}-unit`}>Einheit</Label>
            <select id={`${baseId}-unit`} className={selectClass} {...form.register('unit')}>
              <option value="">–</option>
              {SELECTABLE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {quantityError && (
          <p id={`${baseId}-quantity-error`} className="text-sm text-destructive">
            {quantityError}
          </p>
        )}

        {/* Preview and actions on separate rows: the preview changes while typing and must not move the button. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm sm:min-w-0 sm:flex-1" aria-live="polite">
            {preview.ok ? (
              <>
                <span className="font-semibold">{formatCo2e(preview.co2eKg)}</span>
                {category && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {category.co2e_per_unit.toLocaleString('de-DE')} kg CO₂e pro{' '}
                    {UNIT_LABEL[category.unit]} ·{' '}
                    <a
                      href={category.source_url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      title={category.source}
                      className="underline underline-offset-4"
                    >
                      Quelle
                    </a>
                  </span>
                )}
                {preview.note && <span className="text-muted-foreground"> · {preview.note}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">Kein CO₂-Wert: {preview.message}</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {save.isError && (
              <span role="alert" className="text-sm text-destructive">
                Speichern fehlgeschlagen
              </span>
            )}
            {(isDirty || !item.reviewed) && (
              <Button
                type="submit"
                size="sm"
                variant={isDirty ? 'default' : 'outline'}
                disabled={save.isPending}
              >
                {save.isPending ? <Spinner /> : <Check aria-hidden />}
                {isDirty ? 'Speichern' : 'Passt so'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </li>
  )
}
