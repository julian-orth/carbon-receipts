import { Pencil } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import type { Receipt } from '@/features/receipts/types'
import { useUpdateReceiptDetails } from '../queries'

/** Merchant and purchase date, editable in place (the analysis can misread both). */
export function ReceiptDetailsEditor({ receipt }: { receipt: Receipt }) {
  const [editing, setEditing] = useState(false)
  const [merchant, setMerchant] = useState(receipt.merchant ?? '')
  const [purchasedAt, setPurchasedAt] = useState(receipt.purchased_at ?? '')
  const update = useUpdateReceiptDetails()
  const baseId = useId()

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setMerchant(receipt.merchant ?? '')
          setPurchasedAt(receipt.purchased_at ?? '')
          setEditing(true)
        }}
      >
        <Pencil aria-hidden />
        Händler und Datum ändern
      </Button>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    update.mutate({ id: receipt.id, merchant, purchasedAt }, { onSuccess: () => setEditing(false) })
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Händler und Datum ändern"
      className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor={`${baseId}-merchant`}>Händler</Label>
        <Input
          id={`${baseId}-merchant`}
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          autoComplete="off"
          placeholder="z. B. REWE"
          className="h-10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${baseId}-date`}>Einkaufsdatum</Label>
        <Input
          id={`${baseId}-date`}
          type="date"
          value={purchasedAt}
          onChange={(event) => setPurchasedAt(event.target.value)}
          className="h-10"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Spinner />}
          Speichern
        </Button>
      </div>
      {update.isError && (
        <p role="alert" className="w-full text-sm text-destructive">
          Speichern fehlgeschlagen. Bitte erneut versuchen.
        </p>
      )}
    </form>
  )
}
