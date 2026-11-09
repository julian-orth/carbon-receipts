import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EmissionCategory } from '@/features/categories/categories'
import { CategoryTile } from '@/features/categories/CategoryTile'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaperLine } from '../progress'
import { ALL_DONE, formatKg, STEP } from '../steps'
import { COUNT_UP_MS } from '../timing'
import { useCountUp } from '../use-count-up'

function CountUpKg({ value }: { value: number }) {
  return <>{formatKg(useCountUp(value, COUNT_UP_MS))}</>
}

/** Stagger for printed lines, capped so long receipts do not take forever. */
const lineDelay = (index: number) => `${Math.min(index * 90, 1400)}ms`

const SKELETON_WIDTHS = [82, 64, 74, 56, 70]

type ReceiptPaperProps = {
  /** Shown step: lines print at "prüfen", categories appear at "zuordnen", CO₂e at "berechnen". */
  step: number
  failed: boolean
  merchant: string | null
  purchasedAt: string | null
  lines: readonly PaperLine[] | null
  categoriesById: ReadonlyMap<string, EmissionCategory>
  totalKg: number
  /** The photo while it is uploaded and read (object URL or signed URL). */
  photoUrl: string | null
  linesError?: boolean
  onRetryLines?: () => void
}

/**
 * A receipt drawn in HTML that fills up as the analysis goes on: blank while the photo
 * is uploaded, shimmering while it is read, then the recognised lines print one by one,
 * get their category and finally their CO₂e.
 */
export function ReceiptPaper({
  step,
  failed,
  merchant,
  purchasedAt,
  lines,
  categoriesById,
  totalKg,
  photoUrl,
  linesError = false,
  onRetryLines,
}: ReceiptPaperProps) {
  const printed = lines !== null && step >= STEP.validate
  const categorized = step >= STEP.match
  const calculated = step >= STEP.calculate
  const done = step >= ALL_DONE && !failed
  const reading = !failed && step <= STEP.read

  return (
    <section
      aria-label="Dein Bon"
      // drop-shadow follows the torn edge; a box-shadow would stop above it
      className="relative w-full max-w-[25rem] drop-shadow-[0_14px_22px_rgba(18,20,18,.13)]"
    >
      <div className="relative overflow-hidden rounded-t-md bg-paper px-6 pt-7 pb-5 text-[#1a1c1a] sm:px-7">
        {reading && step === STEP.read && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-scan motion-reduce:hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_18px_5px_rgba(200,241,105,.55)]" />
          </div>
        )}

        <header className="flex flex-col items-center gap-1.5 border-b border-dashed border-[#c9c5b9] pb-4 text-center">
          {printed ? (
            <p className="animate-print text-lg font-semibold tracking-tight">
              {merchant ?? 'Unbekannter Händler'}
            </p>
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'mt-1 h-5 w-40 rounded skeleton-paper',
                reading && 'animate-shimmer motion-reduce:animate-none',
              )}
            />
          )}
          <p className="font-mono text-xs text-paper-muted">
            {printed && purchasedAt ? formatDate(purchasedAt) : '--.--.----'}
          </p>
        </header>

        {linesError ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-6 text-sm">
            <p>Die Positionen konnten nicht geladen werden.</p>
            {onRetryLines && (
              <Button variant="outline" size="sm" onClick={onRetryLines}>
                Erneut laden
              </Button>
            )}
          </div>
        ) : printed ? (
          <ul aria-label="Erkannte Positionen" className="flex flex-col">
            {lines.map((line, index) => {
              const category = line.categoryId ? categoriesById.get(line.categoryId) : undefined
              return (
                <li
                  key={line.id}
                  className="flex animate-print items-center gap-3 border-b border-dotted border-paper-line py-2.5 last:border-b-0"
                  style={{ animationDelay: lineDelay(index) }}
                >
                  {categorized ? (
                    <CategoryTile category={category} size="sm" className="animate-pop" />
                  ) : (
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center">
                      <span className="size-1.5 rounded-full bg-paper-muted" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-[13px] font-medium">{line.name}</span>
                    <span className="truncate text-xs text-paper-muted">
                      {categorized
                        ? [category?.label ?? 'Keine Kategorie', line.quantity]
                            .filter(Boolean)
                            .join(' · ')
                        : line.price}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    {calculated ? (
                      <span className="font-mono text-[13px] font-medium tabular">
                        {line.co2eKg === null ? (
                          <span className="text-paper-muted">–</span>
                        ) : (
                          <>
                            <CountUpKg value={line.co2eKg} /> kg
                          </>
                        )}
                      </span>
                    ) : (
                      categorized && (
                        <span className="font-mono text-xs text-paper-muted tabular">
                          {line.price}
                        </span>
                      )
                    )}
                    {done && line.needsLook && (
                      <span className="inline-flex animate-pop items-center gap-1 text-[11px] font-medium text-warning-foreground">
                        <TriangleAlert aria-hidden className="size-3" />
                        prüfen
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <div aria-hidden="true" className="flex flex-col gap-3.5 py-5">
            {failed ? (
              <p className="py-4 text-center font-mono text-sm text-paper-muted">
                Keine Positionen gelesen
              </p>
            ) : (
              <>
                {step === STEP.upload && photoUrl && (
                  <img
                    src={photoUrl}
                    alt=""
                    className="mx-auto mb-1 h-28 w-auto animate-pop rounded-md object-cover opacity-90 shadow-sm"
                  />
                )}
                {SKELETON_WIDTHS.map((width) => (
                  <div key={width} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'h-3 rounded-[3px] skeleton-paper',
                        reading && 'animate-shimmer motion-reduce:animate-none',
                      )}
                      style={{ width: `${width}%` }}
                    />
                    <span
                      className={cn(
                        'ml-auto h-3 w-10 rounded-[3px] skeleton-paper',
                        reading && 'animate-shimmer motion-reduce:animate-none',
                      )}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <footer className="mt-1 flex items-end justify-between gap-4 border-t border-dashed border-[#c9c5b9] pt-4">
          <p className="font-mono text-xs leading-relaxed text-paper-muted">
            {printed
              ? `${lines.length} Positionen`
              : failed
                ? 'nicht verarbeitet'
                : step === STEP.upload
                  ? 'wird hochgeladen …'
                  : 'wird gelesen …'}
          </p>
          <div className="text-right">
            <p className="font-mono text-[11px] tracking-[0.14em] text-paper-muted uppercase">
              Summe CO₂e
            </p>
            <p className="font-mono text-3xl leading-tight font-medium tracking-tight tabular">
              {calculated && printed ? <CountUpKg value={totalKg} /> : formatKg(0)}
              <span className="text-sm text-paper-muted"> kg</span>
            </p>
          </div>
        </footer>

        {done && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-4 right-4 grid size-16 -rotate-12 animate-pop place-items-center rounded-full border-2 border-success text-[color-mix(in_oklab,var(--success)_78%,black)]"
          >
            <span className="flex flex-col items-center font-mono text-[11px] leading-tight font-bold tracking-widest uppercase">
              <Check className="size-5" strokeWidth={3} />
              Fertig
            </span>
          </div>
        )}
      </div>
      <div aria-hidden="true" className="paper-edge" />
    </section>
  )
}
