import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCo2e } from '@/lib/format-co2'
import type { MonthPoint } from '../dashboard-logic'
import { ChartTable } from './ChartTable'

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 }

function isMonthPoint(value: unknown): value is MonthPoint {
  return typeof value === 'object' && value !== null && 'month' in value && 'totalKg' in value
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point: unknown = payload?.[0]?.payload
  if (!active || !isMonthPoint(point)) return null
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,.12)]">
      <p className="font-medium">
        {point.label}
        {point.isCurrent && ' (laufend)'}
      </p>
      <p className="tabular-nums">{formatCo2e(point.totalKg)}</p>
    </div>
  )
}

export function MonthlyTrendChart({
  series,
  goalKg,
}: {
  series: MonthPoint[]
  goalKg: number | null
}) {
  return (
    <figure>
      <div className="h-64 sm:h-72" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            // Decorative for assistive tech: the table view below is the accessible version.
            accessibilityLayer={false}
            data={series}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="26%"
          >
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={44}
              tickFormatter={(value: number) => value.toLocaleString('de-DE')}
            />
            <Tooltip content={TrendTooltip} cursor={{ fill: 'var(--muted)', radius: 8 }} />
            {goalKg !== null && (
              <ReferenceLine
                y={goalKg}
                stroke="var(--viz-goal)"
                strokeDasharray="4 4"
                label={{
                  value: 'Ziel',
                  position: 'insideTopRight',
                  fill: 'var(--muted-foreground)',
                  fontSize: 12,
                }}
              />
            )}
            <Bar dataKey="totalKg" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {series.map((point) => (
                <Cell
                  key={point.month}
                  // The running month is lighter: it is not complete yet.
                  fill={point.isCurrent ? 'var(--viz-bar-muted)' : 'var(--viz-bar)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-viz-bar" />
          kg CO₂e pro Monat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-viz-bar-muted" />
          laufender Monat
        </span>
        {goalKg !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-3 border-t-2 border-dashed border-viz-goal" />
            Monatsziel
          </span>
        )}
      </figcaption>
      <ChartTable
        caption="CO₂e pro Monat"
        columns={['Monat', 'CO₂e']}
        rows={series.map((point) => [
          `${point.label}${point.isCurrent ? ' (laufend)' : ''}`,
          formatCo2e(point.totalKg),
        ])}
      />
    </figure>
  )
}
