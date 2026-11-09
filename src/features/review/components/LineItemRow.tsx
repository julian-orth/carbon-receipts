import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, CornerDownLeft, Info, TriangleAlert } from 'lucide-react'
import { type KeyboardEvent, useId, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { type EmissionCategory } from '@/features/categories/categories'
import { CategoryPicker } from '@/features/categories/CategoryPicker'
import { CategoryTile } from '@/features/categories/CategoryTile'
import { formatFactor } from '@/features/categories/category-visuals'
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

const SELECTABLE_UNITS = ['kg', 'l', 'piece'] as const satisfies readonly EmissionUnit[]
type SelectableUnit = (typeof SELECTABLE_UNITS)[number]
const isSelectable = (unit: EmissionUnit | null): unit is SelectableUnit =>
  unit === 'kg' || unit === 'l' || unit === 'piece'

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

const priceFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const quantityFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

function formValues(item: LineItem): RowForm {
  return {
    categoryId: item.category_id ?? '',
    quantity: formatQuantityInput(item.quantity),
    unit: isSelectable(item.unit) ? item.unit : '',
  }
}

export type SaveResult = { appliedTo: number }

type LineItemRowProps = {
  item: LineItem
  categories: readonly EmissionCategory[]
  categoriesById: ReadonlyMap<string, EmissionCategory>
  expanded: boolean
  onToggle: () => void
  onSaved: (result: SaveResult) => void
  /** Staggered entrance right after the analysis; null for no animation. */
  enterDelayMs?: number | null
}

/**
 * One receipt line: a compact summary that opens into an editor. The form stays
 * mounted while collapsed, so an unsaved change survives opening another line.
 */
export function LineItemRow({
  item,
  categories,
  categoriesById,
  expanded,
  onToggle,
  onSaved,
  enterDelayMs = null,
}: LineItemRowProps) {
  const save = useSaveLineItem()
  const baseId = useId()
  const values = useMemo(() => formValues(item), [item])
  const form = useForm<RowForm>({
    resolver: zodResolver(rowSchema),
    // Server updates (e.g. a correction learned on another line) flow in, unsaved edits stay.
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const draft = useWatch({ control: form.control })

  const category = draft.categoryId ? categoriesById.get(draft.categoryId) : undefined
  const savedCategory = item.category_id ? categoriesById.get(item.category_id) : undefined
  const quantity = parseQuantityInput(draft.quantity ?? '')
  const unit = draft.unit === undefined || draft.unit === '' ? null : draft.unit
  const preview = computeCo2e(
    { categoryId: draft.categoryId || null, quantity: quantity ?? null, unit, price: item.price },
    category,
  )
  const reasons = attentionReasons(item)
  const open = reasons.length > 0
  const isDirty = form.formState.isDirty
  const quantityError = form.formState.errors.quantity?.message
  const unitMismatch =
    category !== undefined && isSelectable(category.unit) && unit !== null && unit !== category.unit
      ? category.unit
      : null

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
        quantity: nextQuantity,
        unit: nextUnit,
        co2eKg: result.ok ? result.co2eKg : null,
        category: nextCategory ?? null,
      },
      {
        onSuccess: (saved) => {
          form.reset(data)
          onSaved(saved)
        },
      },
    )
  })

  function chooseCategory(categoryId: string) {
    form.setValue('categoryId', categoryId, { shouldDirty: true })
    const next = categoriesById.get(categoryId)
    // Without an amount yet, the category's own unit is the sensible default.
    if (next && isSelectable(next.unit) && (unit === null || quantity == null)) {
      form.setValue('unit', next.unit, { shouldDirty: true })
    }
  }

  function cancel() {
    form.reset(values)
    onToggle()
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // React bubbles events out of portals: Escape inside the category popover only
    // closes the popover, not the line.
    const inside = event.target instanceof Node && event.currentTarget.contains(event.target)
    if (event.key === 'Escape' && inside && !event.defaultPrevented) {
      event.preventDefault()
      onToggle()
      document.getElementById(`${baseId}-toggle`)?.focus()
    }
  }

  const summaryQuantity =
    item.quantity === null || item.unit === null
      ? null
      : `${item.quantity_source === 'estimated' ? '~' : ''}${quantityFormatter.format(item.quantity)} ${UNIT_LABEL[item.unit]}`

  return (
    <li
      data-item-id={item.id}
      style={enterDelayMs === null ? undefined : { animationDelay: `${enterDelayMs}ms` }}
      className={cn(
        'scroll-mt-24 scroll-mb-28 rounded-2xl border bg-card transition-shadow',
        enterDelayMs !== null && 'animate-rise [animation-fill-mode:both]',
        expanded && 'shadow-[0_10px_30px_rgba(18,20,18,.08)] ring-1 ring-foreground/10',
        open && !expanded && 'border-warning/50',
      )}
    >
      <h3 className="m-0">
        <button
          id={`${baseId}-toggle`}
          type="button"
          aria-expanded={expanded}
          aria-controls={`${baseId}-panel`}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-2xl p-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:gap-4 sm:px-4"
        >
          <span
            aria-hidden="true"
            className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tabular"
          >
            {String(item.position).padStart(2, '0')}
          </span>
          <CategoryTile category={savedCategory} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-mono text-sm font-medium">{item.raw_text}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[
                savedCategory?.label ?? 'Keine Kategorie',
                summaryQuantity,
                item.price === null ? null : priceFormatter.format(item.price),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-sm tabular">
              {item.co2e_kg === null ? (
                <span className="text-muted-foreground">–</span>
              ) : (
                formatCo2e(item.co2e_kg)
              )}
            </span>
            <RowStatus open={open} reviewed={item.reviewed} dirty={isDirty} />
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform max-sm:hidden',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </h3>

      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape closes the editor; every control inside stays keyboard operable on its own */}
      <div
        id={`${baseId}-panel`}
        hidden={!expanded}
        onKeyDown={onPanelKeyDown}
        className="border-t px-3 pt-4 pb-4 sm:px-4"
      >
        <form
          onSubmit={(event) => void onSubmit(event)}
          aria-label={item.raw_text}
          className="flex flex-col gap-4"
        >
          {(open || item.quantity_source === 'learned') && !isDirty && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Hinweise">
              {reasons.map((reason) => (
                <li
                  key={reason}
                  className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-foreground"
                >
                  <TriangleAlert aria-hidden className="size-3.5" />
                  {ATTENTION_LABEL[reason]}
                </li>
              ))}
              {item.quantity_source === 'estimated' && (
                <li className="inline-flex items-center px-1 text-xs text-muted-foreground">
                  Übliche Packungsgröße, von der KI geschätzt
                </li>
              )}
              {item.quantity_source === 'learned' && (
                <li className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Info aria-hidden className="size-3.5" />
                  Menge aus deiner früheren Korrektur
                </li>
              )}
            </ul>
          )}

          <div className="flex flex-col gap-1.5">
            <Label id={`${baseId}-category-label`}>Kategorie</Label>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <CategoryPicker
                  categories={categories}
                  value={field.value}
                  onChange={chooseCategory}
                  receiptText={item.raw_text}
                  uncertain={!isDirty && reasons.includes('low_confidence') && field.value !== ''}
                  labelId={`${baseId}-category-label`}
                />
              )}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor={`${baseId}-quantity`}>Menge</Label>
              <Input
                id={`${baseId}-quantity`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="z. B. 0,5"
                className="h-11 font-mono tabular"
                aria-invalid={quantityError ? true : undefined}
                aria-describedby={quantityError ? `${baseId}-quantity-error` : undefined}
                {...form.register('quantity')}
              />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm leading-none font-medium">Einheit</legend>
              <div className="inline-flex h-11 rounded-xl border bg-muted p-1">
                {SELECTABLE_UNITS.map((option) => (
                  <label
                    key={option}
                    className="relative inline-flex cursor-pointer items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors has-checked:bg-card has-checked:font-medium has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input
                      type="radio"
                      value={option}
                      className="sr-only"
                      {...form.register('unit')}
                    />
                    {UNIT_LABEL[option]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {quantityError && (
            <p id={`${baseId}-quantity-error`} className="-mt-2 text-sm text-destructive">
              {quantityError}
            </p>
          )}

          <output
            aria-live="polite"
            className={cn(
              'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3',
              preview.ok ? 'bg-muted' : 'bg-warning-soft text-warning-foreground',
            )}
          >
            {preview.ok ? (
              <>
                <span className="text-2xl font-semibold tracking-tight tabular">
                  {formatCo2e(preview.co2eKg)}
                </span>
                {category && (
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {quantity != null && unit !== null && (
                      <>
                        <span className="font-mono">
                          {quantityFormatter.format(quantity)} {UNIT_LABEL[unit]} ×{' '}
                          {formatFactor(category)}
                        </span>
                        <br />
                      </>
                    )}
                    {preview.note && <>{preview.note} · </>}
                    <a
                      href={category.source_url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Quelle: {category.source}
                    </a>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert aria-hidden className="size-4" />
                  Kein CO₂-Wert: {preview.message}
                </span>
                {unitMismatch && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-card"
                    onClick={() => form.setValue('unit', unitMismatch, { shouldDirty: true })}
                  >
                    Einheit auf {UNIT_LABEL[unitMismatch]} stellen
                  </Button>
                )}
              </>
            )}
          </output>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {save.isError && (
              <span role="alert" className="mr-auto text-sm text-destructive">
                Speichern fehlgeschlagen. Bitte erneut versuchen.
              </span>
            )}
            <Button type="button" variant="ghost" onClick={cancel}>
              {isDirty ? 'Verwerfen' : 'Schließen'}
            </Button>
            <Button type="submit" disabled={save.isPending} className="min-w-36">
              {save.isPending ? <Spinner /> : <Check aria-hidden />}
              {isDirty ? 'Speichern' : 'Passt so'}
              <CornerDownLeft aria-hidden className="ml-1 size-3.5 opacity-60 max-sm:hidden" />
            </Button>
          </div>
        </form>
      </div>
    </li>
  )
}

function RowStatus({
  open,
  reviewed,
  dirty,
}: {
  open: boolean
  reviewed: boolean
  dirty: boolean
}) {
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
        Ungespeichert
      </span>
    )
  }
  if (open) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
        Prüfen
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Check aria-hidden className="size-3.5" />
      {reviewed ? 'Geprüft' : 'Plausibel'}
    </span>
  )
}
