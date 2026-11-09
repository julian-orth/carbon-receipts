import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatCo2e } from '@/lib/format-co2'
import { cn } from '@/lib/utils'
import type { MonthlyGoal } from '../api'
import { goalProgress, type GoalStatus, type MonthComparison } from '../dashboard-logic'
import { GoalForm } from './GoalCard'

const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'always',
})
const share = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })
const kg = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

const STATUS: Record<GoalStatus, { label: string; icon: typeof CircleCheck; ring: string }> = {
  on_track: { label: 'Im Plan', icon: CircleCheck, ring: 'stroke-brand' },
  close: { label: 'Knapp', icon: TriangleAlert, ring: 'stroke-ink-warning' },
  over: { label: 'Überschritten', icon: CircleAlert, ring: 'stroke-ink-danger' },
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type HeroCardProps = {
  monthLabel: string
  currentKg: number
  projectedKg: number | null
  comparison: MonthComparison | null
  goal: MonthlyGoal | null
  averageKg: number | null
}

/**
 * The one loud surface of the dashboard: the running month, where it is heading and
 * how it compares to the monthly goal.
 */
export function HeroCard({
  monthLabel,
  currentKg,
  projectedKg,
  comparison,
  goal,
  averageKg,
}: HeroCardProps) {
  const [editing, setEditing] = useState(false)
  const progress = goal ? goalProgress(currentKg, goal.target_co2e_kg) : null
  const status = progress ? STATUS[progress.status] : null
  const DeltaIcon = comparison && comparison.deltaKg > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex flex-col gap-8 overflow-hidden rounded-3xl bg-hero p-6 text-hero-foreground sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:ring-1 dark:ring-hero-line"
    >
      {/* A faint lime glow: brand, not decoration noise. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-brand/15 blur-3xl"
      />

      <div className="flex min-w-0 flex-col gap-4">
        <h2 id="hero-title" className="text-sm font-medium text-hero-muted">
          {monthLabel} · laufender Monat
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-2 leading-none">
          <span className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
            {kg.format(currentKg)}
          </span>
          <span className="text-lg text-hero-muted">kg CO₂e</span>
        </p>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-hero-muted">Hochrechnung bis Monatsende:</dt>
            <dd className="font-medium">
              {projectedKg === null ? 'noch zu früh im Monat' : `≈ ${formatCo2e(projectedKg)}`}
            </dd>
          </div>
          {comparison && (
            <div className="flex flex-wrap items-center gap-x-1.5">
              <dt className="text-hero-muted">Letzter voller Monat ({comparison.month.label}):</dt>
              <dd className="inline-flex items-center gap-1 font-medium">
                {formatCo2e(comparison.month.totalKg)}
                {comparison.deltaRatio !== null && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                    <DeltaIcon aria-hidden className="size-3.5" />
                    {percent.format(comparison.deltaRatio)}
                    <span className="sr-only"> gegenüber {comparison.previous.label}</span>
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <section aria-label="Monatsziel" className="flex shrink-0 items-center gap-5">
        {goal && progress && status ? (
          <>
            <div className="relative size-32">
              <svg viewBox="0 0 120 120" aria-hidden="true" className="size-32 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="10"
                  className="stroke-hero-line"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(progress.ratio, 1))}
                  className={cn('transition-[stroke-dashoffset] duration-700', status.ring)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tracking-tight">
                  {share.format(progress.ratio)}
                </span>
                <span className="text-xs text-hero-muted">vom Ziel</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 text-sm">
              <p className="inline-flex items-center gap-1.5 font-medium">
                <status.icon aria-hidden className="size-4" />
                {status.label}
              </p>
              <p className="text-hero-muted">Ziel: {formatCo2e(goal.target_co2e_kg)}</p>
              <p className="text-hero-muted">
                {progress.remainingKg >= 0
                  ? `Noch ${formatCo2e(progress.remainingKg)} bis zum Ziel.`
                  : `${formatCo2e(-progress.remainingKg)} über dem Ziel.`}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-1 rounded-full border border-hero-line px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-brand/60 focus-visible:outline-none"
              >
                Ziel ändern
              </button>
            </div>
          </>
        ) : (
          <div className="flex max-w-60 flex-col items-start gap-3 rounded-2xl border border-dashed border-hero-line p-4">
            <Target aria-hidden className="size-6 text-brand" />
            <p className="text-sm text-hero-muted">
              Mit einem Monatsziel siehst du jederzeit, ob du im Plan bist.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:ring-3 focus-visible:ring-brand/60 focus-visible:outline-none"
            >
              Monatsziel festlegen
            </button>
          </div>
        )}
      </section>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5 pr-10">
              <DialogTitle className="text-lg font-semibold">Monatsziel</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Wie viel CO₂e willst du pro Monat höchstens verursachen?
              </DialogDescription>
            </div>
            <GoalForm goal={goal} averageKg={averageKg} onDone={() => setEditing(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
