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
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
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
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            // Decorative for assistive tech: the table view below is the accessible version.
            accessibilityLayer={false}
            data={series}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
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
            <Tooltip content={TrendTooltip} cursor={{ fill: 'var(--muted)' }} />
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
            <Bar dataKey="totalKg" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {series.map((point) => (
                <Cell
                  key={point.month}
                  // The running month is lighter: it is not complete yet.
                  fill={point.isCurrent ? 'var(--viz-series-1-muted)' : 'var(--viz-series-1)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        kg CO₂e pro Monat; der laufende Monat ist heller dargestellt.
        {goalKg !== null && ' Gestrichelt: dein Monatsziel.'}
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
