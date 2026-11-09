import { Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmissionCategories } from '@/features/categories/categories'
import { formatCo2e } from '@/lib/format-co2'
import { AlternativesList } from './components/AlternativesList'
import { useReceipts, useReceiptTotals } from '@/features/receipts/queries'
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
  buildMonthSeries,
  compareCompletedMonths,
  lastMonths,
  projectMonth,
  type RangeMonths,
  receiptStats,
  sumByGroup,
  suggestAlternatives,
} from './dashboard-logic'
import { useGroupTotals, useHotspots, useMonthlyGoal, useMonthlyTotals } from './queries'

const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export function DashboardPage({ today: todayProp }: { today?: Date }) {
  // Fixed for the lifetime of the page; tests pass a date.
  const [today] = useState(() => todayProp ?? new Date())
  const [range, setRange] = useState<RangeMonths>(6)
  const fromMonth = lastMonths(today, range)[0] ?? ''

  const totals = useMonthlyTotals(fromMonth)
  const groups = useGroupTotals(fromMonth)
  const hotspots = useHotspots(fromMonth)
  const goal = useMonthlyGoal()
  const categories = useEmissionCategories()
  const receipts = useReceipts()
  const totalsByReceipt = useReceiptTotals()
  const categoriesBySlug = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.slug, category])),
    [categories.data],
  )

  const series = useMemo(
    () => buildMonthSeries(totals.data ?? [], today, range),
    [totals.data, today, range],
  )
  const queries = [totals, groups, hotspots, goal, categories, receipts, totalsByReceipt]

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <title>Übersicht · Carbon Receipts</title>
      <div className="space-y-1">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05]">
          Übersicht
        </h1>
        <p className="text-muted-foreground">Dein CO₂-Fußabdruck aus bestätigten Belegen.</p>
      </div>
      <RangeFilter value={range} onChange={setRange} />
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
  const groupTotals = sumByGroup(groups.data ?? [], fromMonth)
  const alternatives = suggestAlternatives(hotspots.data ?? [], categories.data ?? [])
  const topHotspots = (hotspots.data ?? []).slice(0, 5)
  const goalKg = goal.data ? goal.data.target_co2e_kg : null
  const stats = receiptStats(receipts.data ?? [], totalsByReceipt.data ?? new Map(), fromMonth)
  const open = (receipts.data ?? []).filter((receipt) => receipt.status === 'review')
  const savingKg = alternatives.reduce((sum, s) => sum + (s.savingKg ?? 0), 0)

  if (rangeTotal === 0 && (hotspots.data ?? []).length === 0) {
    return (
      <div className="space-y-6">
        {header}
        {open.length > 0 && (
          <NextStepCard openCount={open.length} firstOpenId={open[0]?.id ?? null} />
        )}
        <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-14 text-center">
          <p className="text-lg font-medium">Noch keine bestätigten Belege in diesem Zeitraum</p>
          <p className="max-w-md text-muted-foreground">
            Lade ein Foto deines Kassenbons hoch und bestätige die erkannten Positionen – dann
            erscheinen hier Verlauf, Hotspots und Sparpotenzial.
          </p>
          <Button asChild>
            <Link to="/receipts">
              <Upload aria-hidden />
              Beleg hochladen
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {header}

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
        <div className="flex lg:col-span-8 [&>*]:flex-1">
          <HeroCard
            monthLabel={monthName.format(today)}
            currentKg={currentKg}
            projectedKg={projectMonth(currentKg, today)}
            comparison={comparison}
            goal={goal.data ?? null}
            averageKg={averageKg}
          />
        </div>
        <div className="flex flex-col gap-5 sm:gap-6 lg:col-span-4">
          <NextStepCard openCount={open.length} firstOpenId={open[0]?.id ?? null} />
          <RangeStats range={range} totalKg={rangeTotal} stats={stats} />
        </div>

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
        <DashboardCard
          title="Nach Bereich"
          description={`Letzte ${range} Monate`}
          className="lg:col-span-4"
        >
          {groupTotals.length > 0 ? (
            <GroupBreakdownChart groups={groupTotals} />
          ) : (
            <p className="text-sm text-muted-foreground">Keine Daten im Zeitraum.</p>
          )}
        </DashboardCard>

        <DashboardCard
          title="Hotspots"
          description="Deine größten einzelnen Posten"
          className="lg:col-span-5"
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
          className="lg:col-span-7"
        >
          <AlternativesList suggestions={alternatives} categoriesBySlug={categoriesBySlug} />
        </DashboardCard>
      </div>
    </div>
  )
}
