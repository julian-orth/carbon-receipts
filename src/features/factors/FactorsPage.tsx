import { Download, ExternalLink, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryTile, IntensityMeter } from '@/features/categories/CategoryTile'
import { formatFactor } from '@/features/categories/category-visuals'
import { type EmissionCategory, useEmissionCategories } from '@/features/categories/categories'
import { AccuracyCard } from './AccuracyCard'
import { filterFactors, factorsToCsv, groupFactors, summarizeSources } from './factors-logic'

const NOTES = [
  {
    title: 'Ein Durchschnittswert je Kategorie',
    text: 'Herkunft, Bio, Saison und Marke gehen nicht ein. Zwei Tomaten-Positionen werden mit demselben Faktor gerechnet.',
  },
  {
    title: 'Lebensmittel: gesamter Lebenszyklus',
    text: 'Die Werte des ifeu sind Lebenszyklus-Werte und gehen über den reinen Anbau hinaus.',
  },
  {
    title: 'Kraftstoff: nur die Verbrennung',
    text: 'Die Vorkette (Förderung, Raffinerie, Transport) fehlt und würde etwa ein Viertel dazurechnen. Kraftstoff und Lebensmittel sind deshalb nicht direkt vergleichbar.',
  },
  {
    title: 'Annahmen bei Stück und Liter',
    text: 'Eier sind je Stück gerechnet (3,0 kg CO₂e/kg × 60 g). Fertiggerichte gelten je Portion. Getränke stehen je Liter, mit der Dichte 1 kg/l.',
  },
  {
    title: 'Die KI schlägt vor, der Code rechnet',
    text: 'Das Modell ordnet Positionen einer dieser Kategorien zu. Die Rechnung selbst ist eine feste Multiplikation aus Menge und Faktor.',
  },
] as const

function downloadCsv(factors: readonly EmissionCategory[]) {
  const blob = new Blob(['﻿', factorsToCsv(factors)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'emissionsfaktoren.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function FactorsPage() {
  const categories = useEmissionCategories()

  return (
    <div className="space-y-10">
      <title>Datenbasis · Carbon Receipts</title>
      <header className="animate-rise">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05]">
          Datenbasis
        </h1>
        <p className="mt-2.5 max-w-2xl text-base text-muted-foreground sm:text-[17px]">
          Alle Emissionsfaktoren, mit denen deine Belege berechnet werden – vollständig und mit
          Quelle. Stand: November 2026, die Werte werden nicht aktualisiert.
        </p>
      </header>

      {categories.isPending && (
        <output aria-label="Faktoren werden geladen" className="block space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </output>
      )}

      {categories.isError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Faktoren konnten nicht geladen werden</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
            <Button variant="outline" size="sm" onClick={() => void categories.refetch()}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {categories.isSuccess &&
        (categories.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            Es sind noch keine Emissionsfaktoren hinterlegt.
          </p>
        ) : (
          <FactorsContent factors={categories.data} />
        ))}
    </div>
  )
}

function FactorsContent({ factors }: { factors: EmissionCategory[] }) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const groups = groupFactors(factors)
  const sources = summarizeSources(factors)
  const visible = filterFactors(factors, query)
  const visibleGroups = groupFactors(visible)
  const withoutSource = factors.filter((factor) => !factor.source_url).length

  return (
    <>
      <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Faktoren" value={factors.length} />
        <Stat label="Gruppen" value={groups.length} />
        <Stat label="Quellen" value={sources.length} />
      </dl>

      <section aria-labelledby="notes-title" className="space-y-4">
        <h2 id="notes-title" className="text-lg font-semibold tracking-tight">
          Was die Zahlen bedeuten – und was nicht
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {NOTES.map((note) => (
            <li key={note.title} className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-medium">{note.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{note.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <AccuracyCard />

      <section aria-labelledby="sources-title" className="space-y-4">
        <h2 id="sources-title" className="text-lg font-semibold tracking-tight">
          Quellen
        </h2>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {sources.map((source) => (
            <li key={source.url} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0">{source.name}</span>
                <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {source.count} {source.count === 1 ? 'Faktor' : 'Faktoren'}
              </span>
            </li>
          ))}
        </ul>
        {withoutSource > 0 && (
          <p role="alert" className="text-sm text-warning-foreground">
            {withoutSource} {withoutSource === 1 ? 'Faktor hat' : 'Faktoren haben'} keinen
            Quellenlink.
          </p>
        )}
      </section>

      <section aria-labelledby="factors-title" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="factors-title" className="text-lg font-semibold tracking-tight">
              Alle Faktoren
            </h2>
            <p aria-live="polite" className="mt-0.5 text-sm text-muted-foreground">
              {query.trim()
                ? `${visible.length} von ${factors.length} Faktoren`
                : `${factors.length} Faktoren in ${groups.length} Gruppen`}
            </p>
          </div>
          <Button variant="outline" onClick={() => downloadCsv(factors)}>
            <Download aria-hidden="true" />
            Als CSV herunterladen
          </Button>
        </div>

        <div className="relative max-w-md">
          <label htmlFor={searchId} className="sr-only">
            Faktoren durchsuchen
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z. B. Käse, Tab. 3, Diesel"
            className="h-10 pl-9"
          />
        </div>

        {visibleGroups.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            Kein Faktor passt zu „{query.trim()}“.
          </p>
        ) : (
          <div className="space-y-8">
            {visibleGroups.map((group) => (
              <FactorGroupSection key={group.group} {...group} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  )
}

function FactorGroupSection({
  group,
  label,
  factors,
}: {
  group: string
  label: string
  factors: EmissionCategory[]
}) {
  const id = `factor-group-${group}`
  return (
    <section aria-labelledby={id} className="space-y-2.5">
      <h3 id={id} className="flex items-baseline gap-2 text-base font-semibold tracking-tight">
        {label}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {factors.length}
        </span>
      </h3>
      <ul aria-labelledby={id} className="divide-y overflow-hidden rounded-2xl border bg-card">
        {factors.map((factor) => (
          <li
            key={factor.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1.4fr)] md:gap-x-5"
          >
            <CategoryTile category={factor} />
            <p className="min-w-0 text-sm font-medium">{factor.label}</p>
            <p className="flex items-center justify-end gap-2.5 text-right font-mono text-sm">
              <IntensityMeter category={factor} />
              {formatFactor(factor)}
            </p>
            <p className="col-span-3 col-start-1 text-xs text-muted-foreground md:col-span-1 md:col-start-auto">
              {factor.source_url ? (
                <a
                  href={factor.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {factor.source}
                  <span className="sr-only"> (öffnet in neuem Tab)</span>
                </a>
              ) : (
                factor.source
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
