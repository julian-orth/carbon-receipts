import { CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmissionCategory } from './categories'
import { categoryVisual, type Intensity, intensity } from './category-visuals'

const SIZE = {
  sm: { tile: 'size-8 rounded-lg', icon: 'size-4' },
  md: { tile: 'size-10 rounded-xl', icon: 'size-5' },
} as const

/** Square icon tile in the colour of the category group; dashed "?" without category. */
export function CategoryTile({
  category,
  size = 'md',
  className,
}: {
  category: Pick<EmissionCategory, 'slug' | 'category_group'> | undefined
  size?: keyof typeof SIZE
  className?: string
}) {
  if (!category) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center border border-dashed border-warning/60 bg-warning-soft text-warning-foreground',
          SIZE[size].tile,
          className,
        )}
      >
        <CircleHelp className={SIZE[size].icon} />
      </span>
    )
  }
  const { icon: Icon, tile } = categoryVisual(category)
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center', tile, SIZE[size].tile, className)}
    >
      <Icon className={SIZE[size].icon} strokeWidth={1.9} />
    </span>
  )
}

const LEVEL_COLOR: Record<Intensity['level'], string> = {
  1: 'bg-emerald-600',
  2: 'bg-lime-600',
  3: 'bg-amber-500',
  4: 'bg-orange-600',
  5: 'bg-red-600',
}

/** Five rising bars: how climate-intensive a kg/litre of this category is. */
export function IntensityMeter({
  category,
  className,
}: {
  category: Pick<EmissionCategory, 'unit' | 'co2e_per_unit'>
  className?: string
}) {
  const value = intensity(category)
  if (!value) return null
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)}>
      <span className="sr-only">CO₂-Intensität {value.label}</span>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          aria-hidden="true"
          className={cn(
            'w-[3px] rounded-full',
            bar <= value.level ? LEVEL_COLOR[value.level] : 'bg-border',
          )}
          style={{ height: `${4 + bar * 2}px` }}
        />
      ))}
    </span>
  )
}
