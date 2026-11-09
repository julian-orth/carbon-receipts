import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '../status'
import type { ReceiptStatus } from '../types'

const STYLE: Record<ReceiptStatus, { pill: string; dot: string }> = {
  pending: { pill: 'bg-secondary text-secondary-foreground', dot: 'bg-muted-foreground' },
  processing: { pill: 'bg-secondary text-secondary-foreground', dot: 'bg-success animate-blink' },
  review: { pill: 'bg-warning-soft text-warning-foreground', dot: 'bg-warning' },
  done: { pill: 'bg-[#eaf3da] text-[#24410f]', dot: 'bg-success' },
  failed: { pill: 'bg-[#fbe3df] text-[#7a1f15]', dot: 'bg-[#c2412f]' },
}

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const style = STYLE[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        style.pill,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full motion-reduce:animate-none', style.dot)}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}
