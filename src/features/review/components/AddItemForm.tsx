import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { type EmissionCategory } from '@/features/categories/categories'
import { CategoryPicker } from '@/features/categories/CategoryPicker'
import { formatCo2e } from '@/lib/format-co2'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import { useAddLineItem } from '../queries'
import {
  buildNewItem,
  computeCo2e,
  nextPosition,
  type LineItem,
  parsePriceInput,
  parseQuantityInput,
  UNIT_LABEL,
} from '../review-logic'

const UNITS = ['kg', 'l', 'piece'] as const satisfies readonly EmissionUnit[]

const schema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen eingeben, z. B. Haferdrink'),
  categoryId: z.string().min(1, 'Bitte eine Kategorie wählen'),
  quantity: z
    .string()
    .refine((v) => parseQuantityInput(v) !== undefined, 'Bitte eine positive Zahl eingeben'),
  unit: z.enum(['', 'kg', 'l', 'piece']),
  price: z
    .string()
    .refine((v) => parsePriceInput(v) !== undefined, 'Bitte einen Preis wie 2,49 eingeben'),
})
type FormValues = z.infer<typeof schema>

const empty: FormValues = { name: '', categoryId: '', quantity: '', unit: '', price: '' }

/**
 * Adds a line the analysis missed, or all lines of a receipt entered by hand. The CO₂e
 * value is calculated exactly like for a recognised line.
 */
export function AddItemForm({
  receiptId,
  items,
  categories,
  categoriesById,
  startOpen,
}: {
  receiptId: string
  items: readonly LineItem[]
  categories: readonly EmissionCategory[]
  categoriesById: ReadonlyMap<string, EmissionCategory>
  startOpen: boolean
}) {
  const [open, setOpen] = useState(startOpen)
  const [added, setAdded] = useState<string | null>(null)
  const add = useAddLineItem(receiptId)
  const baseId = useId()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty })
  const draft = useWatch({ control: form.control })
  const errors = form.formState.errors

  const category = draft.categoryId ? categoriesById.get(draft.categoryId) : undefined
  const unit = draft.unit ? draft.unit : null
  const preview = category
    ? computeCo2e(
        {
          categoryId: category.id,
          quantity: parseQuantityInput(draft.quantity ?? '') ?? null,
          unit,
          price: parsePriceInput(draft.price ?? '') ?? null,
        },
        category,
      )
    : null

  const onSubmit = form.handleSubmit((values) => {
    const selected = categoriesById.get(values.categoryId)
    if (!selected) return
    const item = buildNewItem(
      {
        name: values.name,
        categoryId: values.categoryId,
        quantity: parseQuantityInput(values.quantity) ?? null,
        unit: values.unit === '' ? null : values.unit,
        price: parsePriceInput(values.price) ?? null,
      },
      selected,
      nextPosition(items),
    )
    add.mutate(item, {
      onSuccess: () => {
        setAdded(`${item.raw_text} hinzugefügt.`)
        form.reset(empty)
        form.setFocus('name')
      },
    })
  })

  function chooseCategory(categoryId: string) {
    form.setValue('categoryId', categoryId, { shouldDirty: true, shouldValidate: true })
    const next = categoriesById.get(categoryId)
    if (next && (next.unit === 'kg' || next.unit === 'l' || next.unit === 'piece') && !unit) {
      form.setValue('unit', next.unit)
    }
  }

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          Position hinzufügen
        </Button>
        <p className="sr-only" aria-live="polite">
          {added}
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      aria-labelledby={`${baseId}-title`}
      className="flex flex-col gap-4 rounded-2xl border border-dashed bg-card p-4 sm:p-5"
    >
      <h3 id={`${baseId}-title`} className="text-base font-semibold">
        Position hinzufügen
      </h3>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${baseId}-name`}>Name auf dem Bon</Label>
        <Input
          id={`${baseId}-name`}
          autoComplete="off"
          placeholder="z. B. Haferdrink"
          className="h-11"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${baseId}-name-error` : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id={`${baseId}-name-error`} className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

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
              receiptText={draft.name ?? ''}
              labelId={`${baseId}-category-label`}
              invalid={errors.categoryId ? true : undefined}
            />
          )}
        />
        {errors.categoryId && (
          <p role="alert" className="text-sm text-destructive">
            {errors.categoryId.message}
          </p>
        )}
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
            aria-invalid={errors.quantity ? true : undefined}
            {...form.register('quantity')}
          />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm leading-none font-medium">Einheit</legend>
          <div className="inline-flex h-11 rounded-xl border bg-muted p-1">
            {UNITS.map((option) => (
              <label
                key={option}
                className="relative inline-flex cursor-pointer items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors has-checked:bg-card has-checked:font-medium has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input type="radio" value={option} className="sr-only" {...form.register('unit')} />
                {UNIT_LABEL[option]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor={`${baseId}-price`}>Preis in € (optional)</Label>
          <Input
            id={`${baseId}-price`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="2,49"
            className="h-11 font-mono tabular"
            aria-invalid={errors.price ? true : undefined}
            {...form.register('price')}
          />
        </div>
      </div>
      {(errors.quantity || errors.price) && (
        <p role="alert" className="-mt-2 text-sm text-destructive">
          {errors.quantity?.message ?? errors.price?.message}
        </p>
      )}

      <output aria-live="polite" className="rounded-xl bg-muted px-4 py-3 text-sm">
        {preview === null ? (
          <span className="text-muted-foreground">
            Wähle eine Kategorie, dann siehst du den Wert.
          </span>
        ) : preview.ok ? (
          <span>
            <span className="text-xl font-semibold tabular">{formatCo2e(preview.co2eKg)}</span>
            {preview.note && <span className="text-muted-foreground"> · {preview.note}</span>}
          </span>
        ) : (
          <span className="text-warning-foreground">Noch kein CO₂-Wert: {preview.message}</span>
        )}
      </output>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {add.isError && (
          <span role="alert" className="mr-auto text-sm text-destructive">
            Hinzufügen fehlgeschlagen. Bitte erneut versuchen.
          </span>
        )}
        {added && <output className="mr-auto text-sm text-muted-foreground">{added}</output>}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset(empty)
            setAdded(null)
            setOpen(false)
          }}
        >
          Schließen
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Spinner /> : <Plus aria-hidden />}
          Hinzufügen
        </Button>
      </div>
    </form>
  )
}
