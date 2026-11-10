import { type ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'

/** A titled dashboard widget; `aside` sits right of the title (a key figure or a link). */
export function DashboardCard({
  title,
  description,
  aside,
  children,
  className,
  busy = false,
}: {
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** The content is being replaced: dimmed and announced as busy. */
  busy?: boolean
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      aria-busy={busy || undefined}
      className={cn(
        'flex flex-col gap-5 rounded-3xl border bg-card p-5 sm:p-6',
        busy && 'opacity-60',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}
