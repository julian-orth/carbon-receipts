import { ArrowDownRight, ArrowUpRight, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmissionCategories } from '@/features/categories'
import { formatCo2e } from '@/lib/format-co2'
import { AlternativesList } from './components/AlternativesList'
import { DashboardCard } from './components/DashboardCard'
import { GoalCard } from './components/GoalCard'
import { GroupBreakdownChart } from './components/GroupBreakdownChart'
import { HotspotList } from './components/HotspotList'
import { MonthlyTrendChart } from './components/MonthlyTrendChart'
import { RangeFilter } from './components/RangeFilter'
import { StatTile } from './components/StatTile'
import {
  buildMonthSeries,
  compareWithPreviousMonth,
  lastMonths,
  type RangeMonths,
  sumByGroup,
  suggestAlternatives,
} from './dashboard-logic'
import { useGroupTotals, useHotspots, useMonthlyGoal, useMonthlyTotals } from './queries'

const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'always',
})

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

  const series = useMemo(
    () => buildMonthSeries(totals.data ?? [], today, range),
    [totals.data, today, range],
  )
  const queries = [totals, groups, hotspots, goal, categories]

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Übersicht</h1>
        <p className="text-muted-foreground">Dein CO₂-Fußabdruck aus bestätigten Belegen.</p>
      </div>
      <RangeFilter value={range} onChange={setRange} />
    </div>
  )

  if (queries.some((q) => q.isPending)) {
    return (
      <div className="space-y-6">
        {header}
        <output aria-label="Übersicht wird geladen" className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-72 sm:col-span-3" />
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
  const comparison = compareWithPreviousMonth(series)
  const groupTotals = sumByGroup(groups.data ?? [], fromMonth)
  const alternatives = suggestAlternatives(hotspots.data ?? [], categories.data ?? [])
  const goalKg = goal.data ? Number(goal.data.target_co2e_kg) : null

  if (rangeTotal === 0 && (hotspots.data ?? []).length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
          <p className="text-lg font-medium">Noch keine bestätigten Belege in diesem Zeitraum</p>
          <p className="max-w-md text-muted-foreground">
            Lade ein Foto deines Kassenbons hoch und bestätige die erkannten Positionen – dann
            erscheinen hier Verlauf, Hotspots und Alternativen.
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

  const DeltaIcon = comparison && comparison.deltaKg > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Dieser Monat (laufend)" value={formatCo2e(comparison?.currentKg ?? 0)} />
        <StatTile
          label="Vormonat"
          value={formatCo2e(comparison?.previousKg ?? 0)}
          detail={
            comparison && comparison.deltaRatio !== null ? (
              <span className="inline-flex items-center gap-1">
                <DeltaIcon aria-hidden className="size-4" />
                {percent.format(comparison.deltaRatio)} im laufenden Monat
              </span>
            ) : null
          }
        />
        <StatTile label={`Summe, letzte ${range} Monate`} value={formatCo2e(rangeTotal)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard title="Verlauf" description="CO₂e pro Monat" className="lg:col-span-2">
          <MonthlyTrendChart series={series} goalKg={goalKg} />
        </DashboardCard>
        <DashboardCard
          title="Monatsziel"
          description="Wie viel CO₂e willst du pro Monat höchstens verursachen?"
        >
          <GoalCard goal={goal.data ?? null} currentKg={comparison?.currentKg ?? 0} />
        </DashboardCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard title="Nach Bereich" description={`Letzte ${range} Monate`}>
          {groupTotals.length > 0 ? (
            <GroupBreakdownChart groups={groupTotals} />
          ) : (
            <p className="text-sm text-muted-foreground">Keine Daten im Zeitraum.</p>
          )}
        </DashboardCard>
        <DashboardCard title="Hotspots" description="Deine größten einzelnen Posten">
          <HotspotList hotspots={hotspots.data ?? []} />
        </DashboardCard>
        <DashboardCard title="Alternativen" description="Gleichwertiger Tausch mit weniger CO₂e">
          <AlternativesList suggestions={alternatives} />
        </DashboardCard>
      </div>
    </div>
  )
}
