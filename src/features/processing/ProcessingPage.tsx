import { ArrowRight, ArrowUpRight, Check, Play, RotateCcw } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { useEmissionCategories } from '@/features/categories/categories'
import { useReceipts, useRetryReceipt, useStartProcessing } from '@/features/receipts/queries'
import { useReceiptsRealtime } from '@/features/receipts/realtime'
import { canStartProcessing } from '@/features/receipts/status'
import type { Receipt } from '@/features/receipts/types'
import { useLineItems, useReceiptImage } from '@/features/review/queries'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/BrandMark'
import { CarbonTape } from './components/CarbonTape'
import { ProcessingLog } from './components/ProcessingLog'
import { ProgressFill } from './components/ProgressFill'
import { ReceiptPhoto } from './components/ReceiptPhoto'
import { KindTag, StepRail, Ticker } from './components/StepRail'
import { buildLog, summarize, toTapeItem } from './progress'
import {
  ALL_DONE,
  displayTarget,
  formatKg,
  isFromUpload,
  providerLabel,
  serverStepIndex,
  STEP,
  STEPS,
} from './steps'
import { CREEP_MS, MIN_STEP_MS } from './timing'
import { usePacedStep } from './use-paced-step'
import { useReceiptTimeline } from './use-receipt-timeline'

export function ProcessingPage() {
  const auth = useAuth()
  const { receiptId } = useParams()
  if (auth.status !== 'authenticated' || !receiptId) return null
  return <ProcessingRoute userId={auth.user.id} receiptId={receiptId} />
}

/** Dark, full-screen frame shared by all states of the live view. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-ink text-ink-foreground [color-scheme:dark]">
      <a
        href="#live-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-foreground"
      >
        Zum Inhalt springen
      </a>
      {children}
    </div>
  )
}

function Header({ fileName }: { fileName: string | null }) {
  return (
    <header className="relative flex items-center gap-4 px-4 py-4 sm:px-8 lg:px-10 lg:py-5">
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-brand/60 focus-visible:outline-none"
      >
        <BrandMark className="size-7" />
        <span className="max-sm:sr-only">Carbon Receipts</span>
      </Link>
      <p className="min-w-0 flex-1 truncate text-center font-mono text-xs text-ink-muted sm:text-[13px]">
        {fileName}
      </p>
      <Link
        to="/receipts"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-ink-line px-4 text-sm font-medium transition-colors hover:border-ink-subtle hover:bg-ink-raised focus-visible:ring-3 focus-visible:ring-brand/60 focus-visible:outline-none"
      >
        <span className="max-sm:sr-only">Im Hintergrund weiter</span>
        <span className="sm:hidden">Weiter</span>
        <ArrowUpRight aria-hidden className="size-4" />
      </Link>
    </header>
  )
}

function CenteredMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Shell>
      <Header fileName={null} />
      <main id="live-main" className="grid flex-1 place-items-center px-4 py-16 text-center">
        <title>{`${title} · Carbon Receipts`}</title>
        <div className="flex max-w-md flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {children}
        </div>
      </main>
    </Shell>
  )
}

function ProcessingRoute({ userId, receiptId }: { userId: string; receiptId: string }) {
  useReceiptsRealtime(userId)
  const receipts = useReceipts()
  const location = useLocation()
  const fromUpload = isFromUpload(location.state)

  if (receipts.isPending) {
    return (
      <Shell>
        <Header fileName={null} />
        <output aria-label="Beleg wird geladen" className="grid flex-1 place-items-center">
          <Spinner className="size-6 text-ink-muted" />
        </output>
      </Shell>
    )
  }

  if (receipts.isError) {
    return (
      <CenteredMessage title="Beleg konnte nicht geladen werden">
        <p className="text-ink-muted">Bitte prüfe deine Verbindung.</p>
        <button
          type="button"
          onClick={() => void receipts.refetch()}
          className="min-h-11 rounded-full bg-brand px-5 font-medium text-brand-foreground"
        >
          Erneut versuchen
        </button>
      </CenteredMessage>
    )
  }

  const receipt = receipts.data.find((r) => r.id === receiptId)
  if (!receipt) {
    return (
      <CenteredMessage title="Beleg nicht gefunden">
        <p className="text-ink-muted">Vielleicht wurde er gelöscht.</p>
        <Link to="/receipts" className="text-brand underline underline-offset-4">
          Zur Belegliste
        </Link>
      </CenteredMessage>
    )
  }

  return <LiveProcessing key={receipt.id} receipt={receipt} fromUpload={fromUpload} />
}

type Story = {
  title: string
  description: string
  tags: { text: string; tone?: 'brand' | 'warn' | 'danger' }[]
}

function LiveProcessing({ receipt, fromUpload }: { receipt: Receipt; fromUpload: boolean }) {
  const [origin] = useState(() => Date.now())
  // A receipt that was already finished when the page opened goes straight to the review.
  const [watched] = useState(
    () =>
      fromUpload ||
      receipt.status === 'pending' ||
      receipt.status === 'processing' ||
      receipt.status === 'failed',
  )

  const complete = receipt.status === 'review' || receipt.status === 'done'
  const items = useLineItems(receipt.id, { enabled: complete })
  const categories = useEmissionCategories()
  const image = useReceiptImage(receipt.file_path)
  const start = useStartProcessing()
  const retry = useRetryReceipt()
  const now = useNow(15_000)

  const failed = receipt.status === 'failed'
  const server = serverStepIndex(receipt)
  const itemsSettled = items.isSuccess || items.isError
  const target = failed ? server : displayTarget(server, itemsSettled)
  const { step, visits } = usePacedStep(target, {
    initial: fromUpload ? STEP.upload : target,
    minStepMs: MIN_STEP_MS,
    origin,
  })

  const { providers, failedAt } = useReceiptTimeline(receipt, origin)
  const lastProvider = providers.at(-1)?.name

  const categoryLabels = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category.label])),
    [categories.data],
  )
  const tapeItems = useMemo(
    () => items.data?.map((item) => toTapeItem(item, (id) => categoryLabels.get(id))) ?? null,
    [items.data, categoryLabels],
  )
  const summary = useMemo(() => (items.data ? summarize(items.data) : null), [items.data])

  const done = !failed && step === ALL_DONE
  const running = !failed && !done
  const waiting = receipt.status === 'pending' && step === STEP.read
  const fellBack = providers.length > 1
  const provider = lastProvider ? providerLabel(lastProvider) : null

  const log = buildLog({
    visits,
    providers,
    status: receipt.status,
    error: receipt.error,
    failedAt,
    fromUpload,
    summary: step >= STEP.match ? summary : null,
  })

  if (!watched && complete) return <Navigate to={`/receipts/${receipt.id}`} replace />

  const story = ((): Story => {
    if (failed) {
      return {
        title: 'Das hat nicht geklappt',
        description:
          receipt.error ??
          'Die Analyse ist fehlgeschlagen. Dein Foto ist gespeichert, du kannst es erneut versuchen.',
        tags: [{ text: `Abbruch bei ${STEPS[step]?.label ?? 'Lesen'}`, tone: 'danger' }],
      }
    }
    if (done && summary) {
      const { attention } = summary
      return {
        title:
          attention === 0
            ? 'Fertig. Alles sieht plausibel aus.'
            : `Fertig. ${attention === 1 ? '1 Position braucht' : `${attention} Positionen brauchen`} deinen Blick.`,
        description: `${summary.count} Positionen erkannt, ${summary.withCo2e} davon mit CO₂-Wert. Nur Schritt 02 war KI, alles andere ist nachvollziehbar berechnet.`,
        tags: [
          { text: `${formatKg(summary.totalKg)} kg CO₂e`, tone: 'brand' },
          { text: `${summary.count} Positionen` },
          ...(attention > 0 ? [{ text: `${attention} offen`, tone: 'warn' as const }] : []),
        ],
      }
    }
    if (waiting) {
      return {
        title: 'Wartet auf den Start',
        description: 'Dein Foto ist gespeichert, die Analyse ist aber noch nicht gestartet.',
        tags: [{ text: 'In Warteschlange' }],
      }
    }
    switch (step) {
      case STEP.upload:
        return {
          title: 'Foto wird hochgeladen',
          description: 'Dein Bon landet in deinem privaten Speicher. Nur du hast Zugriff darauf.',
          tags: [{ text: 'Privater Speicher', tone: 'brand' }],
        }
      case STEP.read:
        return {
          title: 'Die KI liest deinen Bon',
          description:
            'Händler, Datum und jede Position werden aus dem Foto gelesen. Das ist der einzige Schritt, in dem eine KI arbeitet.',
          tags: provider
            ? [
                {
                  text: fellBack ? `${provider} · Fallback` : provider,
                  tone: fellBack ? 'warn' : 'brand',
                },
                ...(fellBack
                  ? [{ text: `${providerLabel(providers[0]?.name ?? '')} überlastet` }]
                  : []),
              ]
            : [{ text: 'Verbindet …' }],
        }
      case STEP.validate:
        return {
          title: 'Ergebnis wird geprüft',
          description:
            'Jede KI-Antwort muss ein festes Schema erfüllen, bevor sie gespeichert wird. Pfand und Leergut fliegen raus.',
          tags: [{ text: 'Schema-Validierung', tone: 'brand' }],
        }
      case STEP.match:
        return {
          title: 'Kategorien & Mengen',
          description:
            'Deine früheren Korrekturen haben Vorrang vor dem KI-Vorschlag. Fehlende Packungsgrößen werden geschätzt.',
          tags: [
            ...(summary && summary.learned > 0
              ? [{ text: `${summary.learned}× gelernt`, tone: 'brand' as const }]
              : []),
            ...(summary && summary.estimated > 0
              ? [{ text: `${summary.estimated}× geschätzt` }]
              : []),
          ],
        }
      default:
        return {
          title: 'CO₂e wird berechnet',
          description:
            'Menge × Emissionsfaktor, jeder Wert mit Quelle. Keine KI, sondern getesteter Code.',
          tags: [{ text: 'Ohne KI', tone: 'brand' }, { text: 'Faktor × Menge' }],
        }
    }
  })()

  const shownNumber = String(Math.min(step, STEPS.length - 1) + 1).padStart(2, '0')
  const fileName = receipt.original_filename ?? receipt.merchant
  const overall = done ? 1 : step / ALL_DONE
  const currentSince = visits.at(-1)?.at ?? 0

  return (
    <Shell>
      <title>{`${story.title} · Carbon Receipts`}</title>

      {/* The whole screen is the progress bar. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <ProgressFill
          value={overall}
          creepTo={running ? (step + 0.9) / ALL_DONE : failed ? overall + 0.1 : undefined}
          creepMs={running ? (CREEP_MS[step] ?? 0) : 0}
          className={failed ? 'bg-ink-danger/[0.06]' : 'bg-brand/[0.05]'}
        >
          {running && (
            <div
              className={cn(
                'absolute inset-y-0 right-0 w-px',
                failed ? 'bg-ink-danger/50' : 'bg-brand/35',
              )}
            />
          )}
        </ProgressFill>
        {done && <div className="absolute inset-0 animate-flash bg-brand opacity-0" />}
      </div>

      <Header fileName={fileName} />

      <div className="relative px-4 pt-1 sm:px-8 lg:px-10">
        <StepRail step={step} failed={failed} visits={visits} origin={origin} />
      </div>

      <main
        id="live-main"
        className={cn(
          'relative mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-x-12 gap-y-10 px-4 pt-10 pb-10 sm:px-8 lg:px-10 lg:pt-14',
          "[grid-template-areas:'story'_'tape'_'log']",
          "md:grid-cols-2 md:grid-rows-[auto_1fr] md:[grid-template-areas:'story_tape'_'log_tape']",
          "lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)_minmax(0,1.15fr)] lg:[grid-template-areas:'story_photo_tape'_'log_photo_tape']",
        )}
      >
        <section
          aria-labelledby="live-title"
          className="flex max-w-md flex-col gap-4 [grid-area:story] sm:gap-5"
        >
          <div key={story.title} className="flex animate-rise flex-col gap-4 sm:gap-5">
            <p aria-hidden="true" className="flex items-baseline gap-1.5 font-mono tabular">
              <span
                className={cn(
                  'text-7xl leading-[0.9] tracking-[-0.05em] sm:text-8xl lg:text-[112px]',
                  failed ? 'text-ink-danger' : 'text-brand',
                )}
              >
                {done ? '05' : shownNumber}
              </span>
              <span className="text-xl text-ink-subtle">/05</span>
              {done && (
                <Check
                  aria-hidden
                  className="ml-2 size-8 animate-pop self-center text-brand"
                  strokeWidth={2.5}
                />
              )}
            </p>
            <h1
              id="live-title"
              className="text-3xl leading-[1.08] font-semibold tracking-[-0.028em] text-balance sm:text-4xl lg:text-[40px]"
            >
              {story.title}
            </h1>
            <p className="text-base leading-relaxed text-ink-foreground/75 sm:text-[17px]">
              {story.description}
            </p>
            {story.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Details">
                {story.tags.map((tag) => (
                  <li
                    key={tag.text}
                    className={cn(
                      'rounded-full px-3 py-1.5 font-mono text-xs',
                      tag.tone === 'brand' && 'bg-brand font-medium text-brand-foreground',
                      tag.tone === 'warn' && 'border border-ink-warning/40 text-ink-warning',
                      tag.tone === 'danger' && 'border border-ink-danger/40 text-ink-danger',
                      !tag.tone && 'border border-ink-line text-ink-foreground/80',
                    )}
                  >
                    {tag.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!done && !failed && !waiting && (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <span>Aktuell:</span>
              <span className="text-ink-foreground">{STEPS[step]?.label}</span>
              {STEPS[step] && <KindTag kind={STEPS[step].kind} />}
            </p>
          )}
        </section>

        <div className="[grid-area:log]">
          <ProcessingLog entries={log} />
        </div>

        <div className="hidden [grid-area:photo] lg:block">
          <ReceiptPhoto
            url={image.data ?? null}
            loading={image.isPending && receipt.file_path !== null}
            scanning={running && step === STEP.read && !waiting}
            caption={
              running && step === STEP.read && provider
                ? `${provider} liest das Foto`
                : 'Originalfoto'
            }
          />
        </div>

        <div className="[grid-area:tape]">
          <CarbonTape
            step={step}
            merchant={receipt.merchant}
            purchasedAt={receipt.purchased_at}
            items={tapeItems}
            itemsError={items.isError}
            onRetryItems={() => void items.refetch()}
            failed={failed}
            totalKg={summary?.totalKg ?? 0}
            attention={summary?.attention ?? 0}
          />
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-ink-line bg-ink/85 px-4 py-4 backdrop-blur-md sm:px-8 lg:px-10 lg:py-5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3">
          <p
            className={cn(
              'min-w-0 flex-[1_1_280px] text-sm leading-normal text-ink-muted',
              (done || failed) && 'max-sm:hidden',
            )}
          >
            {failed
              ? 'Dein Foto ist gespeichert. Ein neuer Versuch beginnt beim Lesen.'
              : done
                ? 'Prüfe die markierten Positionen, dann zählt der Beleg in deiner Übersicht.'
                : 'Du musst nicht warten. Der Beleg erscheint in deiner Liste, sobald er bereit ist.'}
          </p>
          {running && !waiting && (
            <p className="font-mono text-xs text-ink-muted tabular">
              Schritt {shownNumber}/05 · <Ticker since={currentSince} origin={origin} />
            </p>
          )}
          {waiting && canStartProcessing(receipt, now) && (
            <button
              type="button"
              onClick={() => start.mutate(receipt.id)}
              disabled={start.isPending}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-brand-foreground transition hover:bg-[#ddff8f] active:scale-[.98] disabled:opacity-60"
            >
              {start.isPending ? <Spinner /> : <Play aria-hidden className="size-4 fill-current" />}
              Analyse starten
            </button>
          )}
          {failed && (
            <>
              <Link
                to="/receipts"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink-line px-5 font-medium transition-colors hover:bg-ink-raised max-sm:flex-1 max-sm:px-3"
              >
                Zur Belegliste
              </Link>
              <button
                type="button"
                onClick={() => retry.mutate(receipt.id)}
                disabled={retry.isPending}
                className="inline-flex min-h-12 animate-pop items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold whitespace-nowrap text-brand-foreground transition hover:bg-[#ddff8f] active:scale-[.98] disabled:opacity-60 max-sm:flex-[1.4] max-sm:px-4"
              >
                {retry.isPending ? <Spinner /> : <RotateCcw aria-hidden className="size-4" />}
                Erneut versuchen
              </button>
            </>
          )}
          {done && (
            <>
              <Link
                to="/receipts"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink-line px-5 font-medium transition-colors hover:bg-ink-raised max-sm:flex-1 max-sm:px-3"
              >
                <span className="max-sm:hidden">Weiteren Beleg hochladen</span>
                <span className="sm:hidden">Neuer Beleg</span>
              </Link>
              <Link
                to={`/receipts/${receipt.id}`}
                className="inline-flex min-h-12 animate-pop items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold whitespace-nowrap text-brand-foreground transition hover:bg-[#ddff8f] active:scale-[.98] max-sm:flex-[1.4] max-sm:px-4"
              >
                Beleg prüfen
                {summary && summary.attention > 0 && (
                  <span className="font-normal max-sm:sr-only">· {summary.attention} offen</span>
                )}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </>
          )}
          {(start.isError || retry.isError) && (
            <p role="alert" className="basis-full text-sm text-ink-danger">
              Das hat nicht geklappt. Bitte versuche es erneut.
            </p>
          )}
        </div>
      </footer>

      <p className="sr-only" aria-live="polite">
        {story.title}
      </p>
    </Shell>
  )
}
