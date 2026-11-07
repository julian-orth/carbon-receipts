import { FileSpreadsheet, ImageIcon, Receipt as ReceiptIcon, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateTime } from '@/lib/format'
import { useReceipts, useRetryReceipt } from '../queries'
import type { Receipt } from '../types'
import { DeleteReceiptButton } from './DeleteReceiptButton'
import { ReceiptStatusBadge } from './ReceiptStatusBadge'

function receiptLabel(receipt: Receipt): string {
  return receipt.merchant ?? receipt.original_filename ?? 'Beleg'
}

export function ReceiptList() {
  const receipts = useReceipts()

  if (receipts.isPending) {
    return (
      <output aria-label="Belege werden geladen" className="block space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </output>
    )
  }

  if (receipts.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Belege konnten nicht geladen werden</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button variant="outline" size="sm" onClick={() => void receipts.refetch()}>
            Erneut versuchen
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (receipts.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border px-6 py-10 text-center">
        <ReceiptIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Noch keine Belege</p>
        <p className="text-sm text-muted-foreground">
          Lade oben deinen ersten Kassenbon oder Kontoauszug hoch.
        </p>
      </div>
    )
  }

  return (
    <ul aria-labelledby="receipts-list-title" className="divide-y rounded-lg border">
      {receipts.data.map((receipt) => (
        <ReceiptListItem key={receipt.id} receipt={receipt} />
      ))}
    </ul>
  )
}

function ReceiptListItem({ receipt }: { receipt: Receipt }) {
  const retry = useRetryReceipt()
  const label = receiptLabel(receipt)
  const SourceIcon = receipt.source_type === 'csv' ? FileSpreadsheet : ImageIcon

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <SourceIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {receipt.purchased_at ? (
            <>Einkauf am {formatDate(receipt.purchased_at)}</>
          ) : (
            <>
              Hochgeladen am{' '}
              <time dateTime={receipt.created_at}>{formatDateTime(receipt.created_at)}</time>
            </>
          )}
        </p>
        {receipt.status === 'failed' && receipt.error && (
          <p className="text-sm text-destructive">{receipt.error}</p>
        )}
      </div>
      <ReceiptStatusBadge status={receipt.status} />
      <div className="flex items-center gap-1">
        {receipt.status === 'failed' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => retry.mutate(receipt.id)}
            disabled={retry.isPending}
          >
            <RotateCcw aria-hidden />
            Erneut versuchen
          </Button>
        )}
        <DeleteReceiptButton receipt={receipt} label={label} />
      </div>
    </li>
  )
}
