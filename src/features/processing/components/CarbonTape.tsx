import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type TapeItem } from '../progress'
import { ALL_DONE, formatKg, STEP } from '../steps'
import { COUNT_UP_MS } from '../timing'
import { useCountUp } from '../use-count-up'

function CountUpKg({ value }: { value: number }) {
  return <>{formatKg(useCountUp(value, COUNT_UP_MS))}</>
}

type CarbonTapeProps = {
  /** Shown step: rows print at "Prüfen", categories appear at "Zuordnen", CO₂e at "Berechnen". */
  step: number
  merchant: string | null
  purchasedAt: string | null
  items: readonly TapeItem[] | null
  itemsError: boolean
  onRetryItems: () => void
  failed: boolean
  totalKg: number
  attention: number
}

/** Stagger for printed rows, capped so long receipts do not take forever. */
const rowDelay = (index: number) => `${Math.min(index * 80, 1200)}ms`

export function CarbonTape({
  step,
  merchant,
  purchasedAt,
  items,
  itemsError,
  onRetryItems,
  failed,
  totalKg,
  attention,
}: CarbonTapeProps) {
  const printed = items !== null && step >= STEP.validate
  const categorized = step >= STEP.match
  const calculated = step >= STEP.calculate
  const maxKg = Math.max(0.001, ...(items ?? []).map((item) => item.co2eKg ?? 0))

  return (
    <section aria-labelledby="tape-title" className="flex min-w-0 flex-col">
      <div className="rounded-t-lg bg-paper px-5 pt-6 pb-5 text-[#1a1c1a] shadow-[0_30px_60px_rgba(0,0,0,.35)] sm:px-7 sm:pt-7">
        <header className="flex items-start justify-between gap-4 border-b border-dashed border-[#bdb9ae] pb-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-paper-muted uppercase">
              Carbon-Beleg
            </p>
            <h2 id="tape-title" className="mt-1.5 truncate text-2xl font-semibold tracking-tight">
              {printed ? (
                <span className="block animate-print">{merchant ?? 'Unbekannter Händler'}</span>
              ) : (
                <>
                  <span className="sr-only">Wird gelesen</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-6 w-40 animate-shimmer rounded skeleton-paper motion-reduce:animate-none"
                  />
                </>
              )}
            </h2>
          </div>
          <p className="shrink-0 pt-0.5 text-right font-mono text-xs leading-relaxed text-paper-muted">
            {printed && purchasedAt ? formatDate(purchasedAt) : '--.--.----'}
          </p>
        </header>

        {itemsError ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-6 text-sm">
            <p>Die Positionen konnten nicht geladen werden.</p>
            <Button variant="outline" size="sm" onClick={onRetryItems}>
              Erneut laden
            </Button>
          </div>
        ) : printed ? (
          <ul aria-label="Erkannte Positionen" className="flex flex-col py-1">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex animate-print flex-col gap-2 border-b border-dotted border-paper-line py-3"
                style={{ animationDelay: rowDelay(index) }}
              >
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 font-medium break-words">{item.name}</span>
                  {item.price && (
                    <span className="ml-auto shrink-0 font-mono text-sm text-paper-muted tabular">
                      {item.price}
                    </span>
                  )}
                </div>
                <div className="flex min-h-6 flex-wrap items-center gap-2">
                  <span
                    className="inline-flex size-[18px] animate-pop items-center justify-center rounded-full bg-[#1a1c1a]"
                    style={{ animationDelay: rowDelay(index) }}
                  >
                    <Check aria-hidden className="size-3 text-brand" strokeWidth={3.2} />
                    <span className="sr-only">validiert</span>
                  </span>
                  {categorized && (
                    <>
                      <span className="animate-pop rounded bg-[#1a1c1a] px-2 py-0.5 font-mono text-xs text-paper">
                        {item.category ?? 'ohne Kategorie'}
                      </span>
                      {item.quantity && (
                        <span className="animate-pop font-mono text-xs text-[#3d403c]">
                          {item.quantity}
                        </span>
                      )}
                      {item.flags.map((flag) => (
                        <span
                          key={flag.label}
                          className={cn(
                            'animate-pop rounded px-2 py-0.5 font-mono text-xs',
                            flag.tone === 'warn'
                              ? 'bg-warning-soft text-warning-foreground'
                              : 'border border-[#a9a59a] text-[#3d403c]',
                          )}
                        >
                          {flag.label}
                        </span>
                      ))}
                    </>
                  )}
                  {calculated && (
                    <span className="ml-auto font-mono text-sm font-medium tabular">
                      {item.co2eKg === null ? (
                        <span className="text-paper-muted">kein Wert</span>
                      ) : (
                        <>
                          <CountUpKg value={item.co2eKg} /> kg
                        </>
                      )}
                    </span>
                  )}
                </div>
                {calculated && item.co2eKg !== null && (
                  <div
                    aria-hidden="true"
                    className="h-[3px] overflow-hidden rounded-full bg-[#e3e0d6]"
                  >
                    <div
                      className="h-full origin-left animate-grow rounded-full bg-success"
                      style={{ transform: `scaleX(${item.co2eKg / maxKg})` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div aria-hidden="true" className="flex flex-col gap-4 py-6">
            {failed ? (
              <p className="font-mono text-sm text-paper-muted">Keine Positionen gelesen.</p>
            ) : (
              [78, 62, 70, 54].map((width) => (
                <div
                  key={width}
                  className="h-3.5 animate-shimmer rounded-[3px] skeleton-paper motion-reduce:animate-none"
                  style={{ width: `${width}%` }}
                />
              ))
            )}
          </div>
        )}

        <footer className="flex flex-wrap items-end justify-between gap-4 pt-4">
          <p className="font-mono text-xs leading-relaxed text-paper-muted">
            {printed
              ? `${items.length} Positionen erkannt`
              : failed
                ? 'nicht verarbeitet'
                : 'wird gelesen …'}
            {printed && step >= ALL_DONE && attention > 0 && (
              <>
                <br />
                {attention} zu prüfen
              </>
            )}
          </p>
          <div className="text-right">
            <p className="font-mono text-[11px] tracking-[0.14em] text-paper-muted uppercase">
              Summe CO₂e
            </p>
            <p className="mt-0.5 font-mono text-4xl leading-tight font-medium tracking-tight tabular">
              {calculated && printed ? <CountUpKg value={totalKg} /> : formatKg(0)}
              <span className="text-base text-paper-muted"> kg</span>
            </p>
          </div>
        </footer>
      </div>
      <div aria-hidden="true" className="paper-edge" />
    </section>
  )
}
