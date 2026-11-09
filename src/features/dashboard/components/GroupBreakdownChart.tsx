import { GROUP_LABEL } from '@/features/categories/categories'
import { groupVisual } from '@/features/categories/category-visuals'
import { cn } from '@/lib/utils'
import type { GroupTotal } from '../dashboard-logic'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })
const kg = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/**
 * Sorted magnitudes as plain HTML bars in one hue; the group's icon tile carries identity
 * (the same colours as in the category picker). Every bar is labelled with its value.
 */
export function GroupBreakdownChart({ groups }: { groups: GroupTotal[] }) {
  const max = Math.max(...groups.map((g) => g.totalKg), 0.0001)
  return (
    <ul className="flex flex-col gap-4">
      {groups.map((group) => {
        const label = GROUP_LABEL[group.group] ?? group.group
        const { icon: Icon, tile } = groupVisual(group.group)
        return (
          <li key={group.group} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn('grid size-9 shrink-0 place-items-center rounded-xl', tile)}
            >
              <Icon className="size-[18px]" strokeWidth={1.9} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{label}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{kg.format(group.totalKg)} kg</span>{' '}
                  · {percent.format(group.share)}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-viz-bar"
                  style={{ width: `${(group.totalKg / max) * 100}%` }}
                />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
