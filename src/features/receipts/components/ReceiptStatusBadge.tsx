import { AlertCircle, CheckCircle2, Clock, Eye } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { STATUS_LABEL } from '../status'
import type { ReceiptStatus } from '../types'

type BadgeVariant = ComponentProps<typeof Badge>['variant']

const STATUS_STYLE: Record<ReceiptStatus, { variant: BadgeVariant; icon: ReactNode }> = {
  pending: { variant: 'secondary', icon: <Clock aria-hidden /> },
  processing: { variant: 'outline', icon: <Spinner /> },
  review: { variant: 'default', icon: <Eye aria-hidden /> },
  done: { variant: 'secondary', icon: <CheckCircle2 aria-hidden /> },
  failed: { variant: 'destructive', icon: <AlertCircle aria-hidden /> },
}

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const { variant, icon } = STATUS_STYLE[status]
  return (
    <Badge variant={variant}>
      {icon}
      {STATUS_LABEL[status]}
    </Badge>
  )
}
