import type { ReactNode } from 'react'

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <div className="mt-1 text-sm text-muted-foreground">{detail}</div>}
    </div>
  )
}
