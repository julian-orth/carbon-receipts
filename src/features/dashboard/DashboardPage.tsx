import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmissionCategories } from '@/features/categories/categories'
import { formatCo2e } from '@/lib/format-co2'
import { cn } from '@/lib/utils'
import { AlternativesList } from './components/AlternativesList'
import { CoverageNote } from './components/CoverageNote'
import { useReceipts, useReceiptTotals } from '@/features/receipts/queries'
import { SampleReceiptButton } from '@/features/receipts/upload/SampleReceiptButton'
import { UploadButton } from '@/features/receipts/upload/UploadButton'
import { DashboardCard } from './components/DashboardCard'
import { GroupBreakdownChart } from './components/GroupBreakdownChart'
import { HeroCard } from './components/HeroCard'
import { HotspotList } from './components/HotspotList'
import { MonthlyTrendChart } from './components/MonthlyTrendChart'
import { NextStepCard } from './components/NextStepCard'
import { RangeFilter } from './components/RangeFilter'
import { RangeStats } from './components/RangeStats'
import {
  averageCompletedMonth,
  GOAL_BASIS_MONTHS,
  MAX_RANGE_MONTHS,
  buildMonthSeries,
  compareCompletedMonths,
  coverageSince,
  lastMonths,
  projectMonth,
  type RangeMonths,
  receiptStats,
  sumByGroup,
  suggestAlternatives,
  uncoveredExamples,
} from './dashboard-logic'
import {
  useGroupTotals,
  useHotspots,
  useMonthlyCoverage,
  useMonthlyGoal,
  useMonthlyTotals,
  useUncoveredItems,
} from './queries'

const stale = 'transition-opacity duration-200'

/** Heading for everything that follows the range; the hero above is the running month. */
function RangeSection({
  range,
  onChange,
}: {
  range: RangeMonths
  onChange: (value: RangeMonths) => void
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-2">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Auswertung</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Der gewählte Zeitraum gilt für alle Karten darunter. Der laufende Monat oben bleibt
          gleich.
        </p>
      </div>
      <RangeFilter value={range} onChange={onChange} />
    </div>
  )
}

const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export function DashboardPage({ today: todayProp }: { today?: Date }) {
  // Fixed for the lifetime of the page; tests pass a date.
  const [today] = useState(() => todayProp ?? new Date())
  const [range, setRange] = useState<RangeMonths>(6)
  const fromMonth = lastMonths(today, range)[0] ?? ''
  // Monthly figures are loaded once for the longest range; a shorter one is just a slice, so
  // switching the range neither refetches nor flashes a loading state.
  const dataFromMonth = lastMonths(today, MAX_RANGE_MONTHS)[0] ?? ''

  const totals = useMonthlyTotals(dataFromMonth)
  const groups = useGroupTotals(dataFromMonth)
  const hotspots = useHotspots(fromMonth)
  const coverageRows = useMonthlyCoverage(dataFromMonth)
  const uncovered = useUncoveredItems(dataFromMonth)
  const goal = useMonthlyGoal()
  const categories = useEmissionCategories()
  const receipts = useReceipts()
  const totalsByReceipt = useReceiptTotals()
  const categoriesBySlug = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.slug, category])),
    [categories.data],
  )

  const fullSeries = useMemo(
    () => buildMonthSeries(totals.data ?? [], today, MAX_RANGE_MONTHS),
    [totals.data, today],
  )
  const series = useMemo(() => fullSeries.slice(-range), [fullSeries, range])
  const queries = [
    totals,
    groups,
    hotspots,
    coverageRows,
    uncovered,
    goal,
    categories,
    receipts,
    totalsByReceipt,
  ]

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <title>Übersicht · Carbon Receipts</title>
      <div className="space-y-1">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05]">
          Übersicht
        </h1>
        <p className="text-muted-foreground">Dein CO₂-Fußabdruck aus bestätigten Belegen.</p>
      </div>
    </div>
  )

  if (queries.some((q) => q.isPending)) {
    return (
      <div className="space-y-6">
        {header}
        <output aria-label="Übersicht wird geladen" className="grid gap-5 sm:gap-6 lg:grid-cols-12">
          <Skeleton className="h-64 rounded-3xl lg:col-span-8" />
          <Skeleton className="h-64 rounded-3xl lg:col-span-4" />
          <Skeleton className="h-80 rounded-3xl lg:col-span-8" />
          <Skeleton className="h-80 rounded-3xl lg:col-span-4" />
        </output>
      </div>
    )
  }

  if (queries.some((q) => q.isError)) {
    return (
      <div className="space-y-6">
        {header}
        <Alert variant="destructive" role="alert">
          <AlertTitle>Übersicht konnte nicht geladen werden</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all(queries.map((q) => q.refetch()))}
            >
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const rangeTotal = series.reduce((sum, point) => sum + point.totalKg, 0)
  const comparison = compareCompletedMonths(series)
  const currentKg = series.at(-1)?.totalKg ?? 0
  const averageKg = averageCompletedMonth(series)
  // The hero is about the running month; its goal hint must not move with the range.
  const goalBasisKg = averageCompletedMonth(fullSeries.slice(-GOAL_BASIS_MONTHS))
  const hotspotsStale = hotspots.isPlaceholderData
  const groupTotals = sumByGroup(groups.data ?? [], fromMonth)
  const alternatives = suggestAlternatives(hotspots.data ?? [], categories.data ?? [])
  const topHotspots = (hotspots.data ?? []).slice(0, 5)
  const coverage = coverageSince(coverageRows.data ?? [], fromMonth)
  const examples = uncoveredExamples(uncovered.data ?? [], fromMonth)
  const goalKg = goal.data ? goal.data.target_co2e_kg : null
  const stats = receiptStats(receipts.data ?? [], totalsByReceipt.data ?? new Map(), fromMonth)
  const open = (receipts.data ?? []).filter((receipt) => receipt.status === 'review')
  const savingKg = alternatives.reduce((sum, s) => sum + (s.savingKg ?? 0), 0)

  if (rangeTotal === 0 && (hotspots.data ?? []).length === 0) {
    return (
      <div className="space-y-6">
        {header}
        {open.length > 0 && (
          <NextStepCard
            openCount={open.length}
            firstOpenId={open[0]?.id ?? null}
            showUpload={false}
          />
        )}
        {/* Nothing in any range: nothing to switch between. */}
        {fullSeries.some((point) => point.totalKg > 0) && (
          <RangeSection range={range} onChange={setRange} />
        )}
        <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-14 text-center">
          <p className="text-lg font-medium">Noch keine bestätigten Belege in diesem Zeitraum</p>
          <p className="max-w-md text-muted-foreground">
            Lade ein Foto deines Kassenbons hoch und bestätige die erkannten Positionen – dann
            erscheinen hier Verlauf, Hotspots und Sparpotenzial.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <UploadButton className="h-11 px-5" />
            <SampleReceiptButton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {header}

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="flex lg:col-span-8 [&>*]:flex-1">
          <HeroCard
            monthLabel={monthName.format(today)}
            currentKg={currentKg}
            projectedKg={projectMonth(currentKg, today)}
            comparison={comparison}
            goal={goal.data ?? null}
            averageKg={goalBasisKg}
          />
        </div>
        <div className="flex lg:col-span-4 [&>*]:flex-1">
          <NextStepCard openCount={open.length} firstOpenId={open[0]?.id ?? null} />
        </div>
      </div>

      <RangeSection range={range} onChange={setRange} />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <DashboardCard
          title="Verlauf"
          description="CO₂e pro Monat aus bestätigten Belegen"
          aside={
            averageKg !== null && (
              <p className="text-sm sm:text-right">
                <span className="block text-xs text-muted-foreground">Ø pro Monat</span>
                <span className="font-semibold">{formatCo2e(averageKg)}</span>
              </p>
            )
          }
          className="lg:col-span-8"
        >
          <MonthlyTrendChart series={series} goalKg={goalKg} />
        </DashboardCard>
        <div className="flex flex-col gap-5 sm:gap-6 lg:col-span-4">
          <RangeStats range={range} totalKg={rangeTotal} stats={stats} />
          <CoverageNote coverage={coverage} examples={examples} />
          <DashboardCard
            title="Nach Bereich"
            description={`Letzte ${range} Monate`}
            className="flex-1"
          >
            {groupTotals.length > 0 ? (
              <GroupBreakdownChart groups={groupTotals} />
            ) : (
              <p className="text-sm text-muted-foreground">Keine Daten im Zeitraum.</p>
            )}
          </DashboardCard>
        </div>

        <DashboardCard
          title="Hotspots"
          description="Deine größten einzelnen Posten"
          className={cn('lg:col-span-5', stale)}
          busy={hotspotsStale}
        >
          <HotspotList hotspots={topHotspots} categoriesBySlug={categoriesBySlug} />
        </DashboardCard>
        <DashboardCard
          title="Sparpotenzial"
          description="Gleichwertiger Tausch mit weniger CO₂e, gerechnet auf deinen Einkauf"
          aside={
            savingKg > 0 && (
              <p className="text-sm sm:text-right">
                <span className="block text-xs text-muted-foreground">zusammen bis zu</span>
                <span className="font-semibold text-success">−{formatCo2e(savingKg)}</span>
              </p>
            )
          }
          className={cn('lg:col-span-7', stale)}
          busy={hotspotsStale}
        >
          <AlternativesList suggestions={alternatives} categoriesBySlug={categoriesBySlug} />
        </DashboardCard>
      </div>
    </div>
  )
}
