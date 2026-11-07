import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { GROUP_LABEL } from '@/features/categories'
import { formatCo2e } from '@/lib/format-co2'
import type { GroupTotal } from '../dashboard-logic'
import { ChartTable } from './ChartTable'

type Row = GroupTotal & { label: string }

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

function GroupTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{row.label}</p>
      <p className="tabular-nums">
        {formatCo2e(row.totalKg)} · {percent.format(row.share)}
      </p>
    </div>
  )
}

/** Horizontal bars, sorted by size; identity is carried by the labels, not by colour. */
export function GroupBreakdownChart({ groups }: { groups: GroupTotal[] }) {
  const rows: Row[] = groups.map((g) => ({ ...g, label: GROUP_LABEL[g.group] ?? g.group }))
  return (
    <figure>
      <div style={{ height: Math.max(120, rows.length * 40) }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={150}
              tick={{ fill: 'var(--foreground)', fontSize: 13 }}
            />
            <Tooltip content={GroupTooltip} cursor={{ fill: 'var(--muted)' }} />
            <Bar
              dataKey="totalKg"
              fill="var(--viz-series-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="CO₂e nach Bereich"
        columns={['Bereich', 'CO₂e (Anteil)']}
        rows={rows.map((row) => [
          row.label,
          `${formatCo2e(row.totalKg)} (${percent.format(row.share)})`,
        ])}
      />
    </figure>
  )
}
