import {
  ArrowLeft,
  Camera,
  CheckCheck,
  ExternalLink,
  ImageOff,
  Info,
  PartyPopper,
  Play,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useEmissionCategories } from '@/features/categories/categories'
import { MiniSteps } from '@/features/processing/components/MiniSteps'
import { ProcessingDialog } from '@/features/processing/ProcessingDialog'
import { isFromUpload, serverStepIndex, STEPS } from '@/features/processing/steps'
import { ReceiptStatusBadge } from '@/features/receipts/components/ReceiptStatusBadge'
import { failureHelp, noteHelp } from '@/features/receipts/failure'
import { useReceipts } from '@/features/receipts/queries'
import type { Receipt } from '@/features/receipts/types'
import { useUploadFlow } from '@/features/receipts/upload/upload-flow-context'
import { formatDate } from '@/lib/format'
import { formatCo2e } from '@/lib/format-co2'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { sumCo2e } from '@shared/emissions/calculate.ts'
import { LineItemRow, type SaveResult } from './components/LineItemRow'
import { useConfirmReceipt, useLineItems, useReceiptImage } from './queries'
import { attentionReasons, type LineItem } from './review-logic'

const isComplete = (receipt: Receipt) => receipt.status === 'review' || receipt.status === 'done'

export function ReviewPage() {
  const { receiptId = '' } = useParams()
  const receipts = useReceipts()

  if (receipts.isPending) {
    return (
      <output aria-label="Beleg wird geladen" className="block space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </output>
    )
  }
  if (receipts.isError) {
    return <LoadError onRetry={() => void receipts.refetch()} />
  }
  const receipt = receipts.data.find((r) => r.id === receiptId)
  if (!receipt) {
    return (
      <section className="space-y-3">
        <title>Beleg nicht gefunden · Carbon Receipts</title>
        <h1 className="text-2xl font-semibold">Beleg nicht gefunden</h1>
        <p className="text-muted-foreground">Vielleicht wurde er gelöscht.</p>
        <Link to="/receipts" className="underline underline-offset-4">
          Zurück zu den Belegen
        </Link>
      </section>
    )
  }
  return <ReceiptView key={receipt.id} receipt={receipt} />
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Beleg konnte nicht geladen werden</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * One page per receipt: while it is analysed, the progress runs in a dialog on top;
 * afterwards the same page is where the result is checked and corrected.
 */
function ReceiptView({ receipt }: { receipt: Receipt }) {
  const location = useLocation()
  const fromUpload = isFromUpload(location.state)
  const complete = isComplete(receipt)
  const items = useLineItems(receipt.id, { enabled: complete })
  const categories = useEmissionCategories()
  const image = useReceiptImage(receipt.file_path)
  // Watching starts with the upload or when the page opens on an unfinished receipt;
  // a receipt that was finished before is shown without the dialog.
  const [watching] = useState(() => fromUpload || !isComplete(receipt))
  const [dismissed, setDismissed] = useState(false)
  const dialogOpen = watching && !dismissed

  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  )
  const title = receipt.merchant ?? receipt.original_filename ?? 'Beleg'
  const itemsReady = complete && items.isSuccess && categories.isSuccess

  return (
    <div className="space-y-6">
      <title>{`${title} · Carbon Receipts`}</title>
      <Link
        to="/receipts"
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" /> Alle Belege
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <ReceiptHeader receipt={receipt} title={title} items={itemsReady ? items.data : null} />
          {!complete ? (
            <AnalysisPlaceholder receipt={receipt} onShowProgress={() => setDismissed(false)} />
          ) : items.isError || categories.isError ? (
            <LoadError onRetry={() => void Promise.all([items.refetch(), categories.refetch()])} />
          ) : itemsReady ? (
            <ItemEditor
              receipt={receipt}
              items={items.data}
              categories={categories.data}
              animate={watching}
            />
          ) : (
            <output aria-label="Positionen werden geladen" className="block space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-16 w-full rounded-2xl" />
              ))}
            </output>
          )}
        </div>

        <aside aria-label="Foto des Belegs" className="lg:sticky lg:top-20">
          <PhotoPanel
            path={receipt.file_path}
            url={image.data ?? null}
            loading={image.isPending}
            error={image.isError}
          />
        </aside>
      </div>

      {watching && (
        <ProcessingDialog
          receipt={receipt}
          items={complete && items.isSuccess ? items.data : null}
          itemsSettled={items.isSuccess || items.isError}
          itemsError={items.isError}
          onRetryItems={() => void items.refetch()}
          categoriesById={categoriesById}
          imageUrl={image.data ?? null}
          fromUpload={fromUpload}
          open={dialogOpen}
          onOpenChange={(open) => setDismissed(!open)}
        />
      )}
    </div>
  )
}

function ReceiptHeader({
  receipt,
  title,
  items,
}: {
  receipt: Receipt
  title: string
  items: readonly LineItem[] | null
}) {
  const total = items ? sumCo2e(items.map((item) => item.co2e_kg)) : null
  const ok = items ? items.filter((item) => attentionReasons(item).length === 0).length : 0
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 space-y-1.5">
        <h1 className="truncate text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {receipt.purchased_at && <span>Einkauf am {formatDate(receipt.purchased_at)}</span>}
          <ReceiptStatusBadge status={receipt.status} />
        </p>
      </div>
      {items && total !== null && (
        <div className="flex items-end gap-6">
          <div className="min-w-32">
            <p className="text-xs text-muted-foreground">{`${ok} von ${items.length} geprüft`}</p>
            <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-success transition-[width] duration-500"
                style={{ width: `${items.length === 0 ? 100 : (ok / items.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Summe</p>
            <p className="text-2xl font-semibold tracking-tight tabular">{formatCo2e(total)}</p>
          </div>
        </div>
      )}
    </header>
  )
}

function AnalysisPlaceholder({
  receipt,
  onShowProgress,
}: {
  receipt: Receipt
  onShowProgress: () => void
}) {
  const step = serverStepIndex(receipt)
  const failed = receipt.status === 'failed'
  const help = failureHelp(receipt.error_code)
  const { openPicker } = useUploadFlow()
  return (
    <section
      aria-labelledby="analysis-title"
      className="flex flex-col gap-4 rounded-2xl border border-dashed bg-card p-6"
    >
      <div className="space-y-1">
        <h2 id="analysis-title" className="text-lg font-semibold">
          {failed
            ? help.title
            : receipt.status === 'pending'
              ? 'Wartet auf die Analyse'
              : `Wird analysiert: ${STEPS[step]?.label ?? 'Bon lesen'}`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {failed
            ? (receipt.error ?? 'Dein Foto ist gespeichert, du kannst es erneut versuchen.')
            : 'Die Positionen erscheinen hier, sobald die Analyse fertig ist.'}
        </p>
        {failed && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {help.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </div>
      {!failed && <MiniSteps step={step} running={receipt.status === 'processing'} />}
      <div className="flex flex-wrap gap-2">
        {failed && help.canUploadNew && (
          <Button onClick={openPicker}>
            <Camera aria-hidden />
            Neues Foto hochladen
          </Button>
        )}
        <Button variant="outline" onClick={onShowProgress}>
          {failed && help.canRetry ? <Play aria-hidden /> : null}
          {failed
            ? help.canRetry
              ? 'Details & neuer Versuch'
              : 'Details'
            : 'Fortschritt anzeigen'}
        </Button>
      </div>
    </section>
  )
}

function PhotoPanel({
  path,
  url,
  loading,
  error,
}: {
  path: string | null
  url: string | null
  loading: boolean
  error: boolean
}) {
  if (path === null || error) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-6" />
        Foto nicht verfügbar
      </div>
    )
  }
  if (loading || url === null) return <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
  return (
    <figure className="m-0 overflow-hidden rounded-2xl border bg-card">
      <img
        src={url}
        alt="Foto des Kassenbons"
        decoding="async"
        className="max-h-[50svh] w-full bg-paper object-contain lg:max-h-[calc(100svh-10rem)]"
      />
      <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        Originalfoto zum Vergleich
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Groß öffnen <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(neuer Tab)</span>
        </a>
      </figcaption>
    </figure>
  )
}

type Filter = 'all' | 'open'

const isOpen = (item: LineItem) => attentionReasons(item).length > 0

/** Moves focus to a line's toggle and scrolls it into view after the next render. */
function focusRow(id: string) {
  requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
    row?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus({ preventScroll: true })
    row?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  })
}

function ItemEditor({
  receipt,
  items,
  categories,
  animate,
}: {
  receipt: Receipt
  items: readonly LineItem[]
  categories: NonNullable<ReturnType<typeof useEmissionCategories>['data']>
  animate: boolean
}) {
  const confirm = useConfirmReceipt(receipt.id)
  const doneHeadingRef = useRef<HTMLParagraphElement>(null)
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const openItems = items.filter(isOpen)
  // The first line that needs a look starts open: reviewing is one line after another.
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    receipt.status === 'review' ? (items.find(isOpen)?.id ?? null) : null,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (confirm.isSuccess) doneHeadingRef.current?.focus()
  }, [confirm.isSuccess])

  // Receipt order on purpose: re-sorting after each save would move the row being edited.
  const shown =
    filter === 'open' ? items.filter((item) => isOpen(item) || item.id === expandedId) : items
  const withoutCo2e = items.filter((item) => item.co2e_kg === null).length

  function onSaved(item: LineItem, result: SaveResult) {
    setNotice(
      result.appliedTo > 0
        ? `${item.raw_text} gespeichert, auch bei ${result.appliedTo} weiteren offenen ${result.appliedTo === 1 ? 'Position' : 'Positionen'} übernommen.`
        : `${item.raw_text} gespeichert.`,
    )
    // Next line that still needs a look, after this one first, then from the top.
    const index = items.findIndex((candidate) => candidate.id === item.id)
    const next = [...items.slice(index + 1), ...items.slice(0, index)].find(
      (candidate) => candidate.id !== item.id && isOpen(candidate),
    )
    setExpandedId(next?.id ?? null)
    focusRow(next?.id ?? item.id)
  }

  const notes = noteHelp(receipt.notes)

  return (
    <>
      {notes.length > 0 && (
        <Alert aria-label="Hinweise zur Analyse">
          <Info aria-hidden />
          <AlertTitle>Beim Lesen ist uns etwas aufgefallen</AlertTitle>
          <AlertDescription>
            <ul className="space-y-1.5">
              {notes.map((note) => (
                <li key={note.title}>
                  <strong className="font-medium">{note.title}.</strong> {note.text}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <section aria-labelledby="items-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="items-title" className="text-lg font-semibold">
            Positionen
          </h2>
          {items.length > 0 && (
            <fieldset className="inline-flex rounded-xl border bg-muted p-1 text-sm">
              <legend className="sr-only">Positionen filtern</legend>
              {(
                [
                  ['all', 'Alle', items.length],
                  ['open', 'Zu prüfen', openItems.length],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-muted-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-sm"
                >
                  {label}{' '}
                  <span
                    className={cn(
                      'rounded-full px-1.5 font-mono text-xs tabular',
                      value === 'open' && count > 0
                        ? 'bg-warning-soft text-warning-foreground'
                        : 'bg-border/60',
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </fieldset>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {notice}
        </p>

        {items.length === 0 ? (
          <p className="rounded-2xl border p-6 text-center text-muted-foreground">
            Auf diesem Beleg wurden keine Positionen erkannt.
          </p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
            <PartyPopper aria-hidden className="size-6 text-success" />
            <p className="font-medium">Alles geprüft</p>
            <p className="text-sm text-muted-foreground">
              {receipt.status === 'review'
                ? 'Bestätige den Beleg, dann zählt er in deiner Übersicht.'
                : 'Dieser Beleg zählt bereits in deiner Übersicht.'}
            </p>
          </div>
        ) : (
          <ul aria-labelledby="items-title" className="space-y-2">
            {shown.map((item, index) => (
              <LineItemRow
                key={item.id}
                item={item}
                categories={categories}
                categoriesById={categoriesById}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onSaved={(result) => onSaved(item, result)}
                enterDelayMs={animate ? Math.min(index, 12) * 40 : null}
              />
            ))}
          </ul>
        )}
      </section>

      {receipt.status === 'review' && (
        <section
          aria-label="Beleg bestätigen"
          className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:shadow-[0_-8px_24px_rgba(18,20,18,.06)]"
        >
          <p className="min-w-0 text-sm text-muted-foreground">
            <span className="max-sm:hidden">
              {openItems.length > 0
                ? `${openItems.length} ${openItems.length === 1 ? 'Position ist' : 'Positionen sind'} noch offen. Bestätigen übernimmt alles wie angezeigt.`
                : withoutCo2e > 0
                  ? `${withoutCo2e} ${withoutCo2e === 1 ? 'Position' : 'Positionen'} ohne CO₂-Wert ${withoutCo2e === 1 ? 'zählt' : 'zählen'} nicht zur Summe.`
                  : 'Alle Positionen haben einen CO₂-Wert.'}
            </span>
            <span className="sm:hidden">
              {openItems.length > 0 ? `${openItems.length} noch offen` : 'Alles geprüft'}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {confirm.isError && (
              <span role="alert" className="text-sm text-destructive">
                Bestätigen fehlgeschlagen
              </span>
            )}
            <Button
              onClick={() => confirm.mutate()}
              disabled={confirm.isPending}
              variant={openItems.length > 0 ? 'outline' : 'default'}
            >
              {confirm.isPending ? <Spinner /> : <CheckCheck aria-hidden />}
              Beleg bestätigen
            </Button>
          </div>
        </section>
      )}

      {receipt.status === 'done' && (
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
    </>
  )
}
