import { PenLine } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { isoDay } from '../api'
import { useCreateManualReceipt, useStartManualEntry } from '../queries'

/** "Von Hand erfassen": a new receipt without a photo, opened right away for typing. */
export function NewManualReceiptButton({ className }: { className?: string }) {
  const create = useCreateManualReceipt()
  const navigate = useNavigate()
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={create.isPending}
        className={cn('h-10 rounded-full px-4', className)}
        onClick={() =>
          create.mutate(isoDay(new Date()), { onSuccess: (id) => void navigate(`/receipts/${id}`) })
        }
      >
        {create.isPending ? <Spinner /> : <PenLine aria-hidden />}
        Von Hand erfassen
      </Button>
      {create.isError && (
        <span role="alert" className="text-sm text-destructive">
          Der Beleg konnte nicht angelegt werden.
        </span>
      )}
    </>
  )
}

/** Takes over a failed receipt: the photo stays, the items are typed in. */
export function ManualEntryForFailedButton({
  receiptId,
  onStarted,
  size = 'default',
  className,
}: {
  receiptId: string
  onStarted?: () => void
  size?: 'default' | 'lg'
  className?: string
}) {
  const start = useStartManualEntry()
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={start.isPending}
        className={className}
        onClick={() => start.mutate(receiptId, { onSuccess: onStarted })}
      >
        {start.isPending ? <Spinner /> : <PenLine aria-hidden />}
        Von Hand erfassen
      </Button>
      {start.isError && (
        <span role="alert" className="text-sm text-destructive">
          Das hat nicht geklappt. Bitte versuche es erneut.
        </span>
      )}
    </>
  )
}
