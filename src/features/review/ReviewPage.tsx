import { ArrowLeft, CheckCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useEmissionCategories } from '@/features/categories/categories'
import { ReceiptStatusBadge } from '@/features/receipts/components/ReceiptStatusBadge'
import { formatDate } from '@/lib/format'
import { formatCo2e } from '@/lib/format-co2'
import { sumCo2e } from '@shared/emissions/calculate.ts'
import { LineItemRow } from './components/LineItemRow'
import { ReceiptImage } from './components/ReceiptImage'
import { useConfirmReceipt, useLineItems, useReviewReceipt } from './queries'
import { attentionReasons } from './review-logic'

export function ReviewPage() {
  const { receiptId = '' } = useParams()
  const receipt = useReviewReceipt(receiptId)
  const items = useLineItems(receiptId)
  const categories = useEmissionCategories()
  const confirm = useConfirmReceipt(receiptId)
  const doneHeadingRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (confirm.isSuccess) doneHeadingRef.current?.focus()
  }, [confirm.isSuccess])

  if (receipt.isPending || items.isPending || categories.isPending) {
    return (
      <output aria-label="Beleg wird geladen" className="block space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </output>
    )
  }

  if (receipt.isError || items.isError || categories.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Beleg konnte nicht geladen werden</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void Promise.all([receipt.refetch(), items.refetch(), categories.refetch()])
            }
          >
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (receipt.data === null) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Beleg nicht gefunden</h1>
        <Link to="/receipts" className="underline underline-offset-4">
          Zurück zu den Belegen
        </Link>
      </section>
    )
  }

  const data = receipt.data
  // Receipt order on purpose: re-sorting after each save would move the row being edited.
  const lineItems = items.data
  const total = sumCo2e(items.data.map((item) => item.co2e_kg))
  const openCount = items.data.filter((item) => attentionReasons(item).length > 0).length
  const withoutCo2e = items.data.filter((item) => item.co2e_kg === null).length
  const title = data.merchant ?? data.original_filename ?? 'Beleg'

  return (
    <div className="space-y-6">
      <Link
        to="/receipts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Alle Belege
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {data.purchased_at && <span>Einkauf am {formatDate(data.purchased_at)}</span>}
            <ReceiptStatusBadge status={data.status} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Summe</p>
          <p className="text-2xl font-semibold">{formatCo2e(total)}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="items-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="items-title" className="text-lg font-semibold">
              Positionen ({items.data.length})
            </h2>
            {openCount > 0 && (
              <p className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="size-4" />
                {openCount === 1 ? '1 Position braucht' : `${openCount} Positionen brauchen`} deine
                Prüfung
              </p>
            )}
          </div>

          {lineItems.length === 0 ? (
            <p className="rounded-lg border p-6 text-center text-muted-foreground">
              Auf diesem Beleg wurden keine Positionen erkannt.
            </p>
          ) : (
            <ul aria-labelledby="items-title" className="space-y-3">
              {lineItems.map((item) => (
                <LineItemRow key={item.id} item={item} categories={categories.data} />
              ))}
            </ul>
          )}
        </section>

        <aside aria-label="Foto des Belegs" className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <ReceiptImage path={data.file_path} />
        </aside>
      </div>

      {data.status === 'review' && (
        <section
          aria-label="Beleg bestätigen"
          className="-mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-0"
        >
          <p className="text-sm text-muted-foreground">
            {withoutCo2e > 0
              ? `${withoutCo2e} ${withoutCo2e === 1 ? 'Position' : 'Positionen'} ohne CO₂-Wert ${withoutCo2e === 1 ? 'zählt' : 'zählen'} nicht zur Summe.`
              : 'Alle Positionen haben einen CO₂-Wert.'}
          </p>
          <div className="flex items-center gap-2">
            {confirm.isError && (
              <span role="alert" className="text-sm text-destructive">
                Bestätigen fehlgeschlagen
              </span>
            )}
            <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              {confirm.isPending ? <Spinner /> : <CheckCheck aria-hidden />}
              Beleg bestätigen
            </Button>
          </div>
        </section>
      )}

      {data.status === 'done' && (
        <Alert>
          <CheckCheck aria-hidden />
          <AlertTitle>
            <p ref={doneHeadingRef} tabIndex={-1} className="outline-none">
              Beleg bestätigt
            </p>
          </AlertTitle>
          <AlertDescription>
            <p>
              Er fließt jetzt in deine{' '}
              <Link to="/" className="underline underline-offset-4">
                Übersicht
              </Link>{' '}
              ein. Änderungen an Positionen sind weiterhin möglich.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
