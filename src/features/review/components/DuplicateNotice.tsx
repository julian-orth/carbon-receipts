import { CopyCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DeleteReceiptButton } from '@/features/receipts/components/DeleteReceiptButton'
import type { Receipt } from '@/features/receipts/types'
import { formatDate } from '@/lib/format'
import { useDuplicateReceipts } from '../queries'

/**
 * "This looks like a receipt you already have": same merchant, day, item count and price sum.
 * Only while the receipt is still being reviewed – once confirmed it is the user's decision.
 */
export function DuplicateNotice({ receipt }: { receipt: Receipt }) {
  const duplicates = useDuplicateReceipts(receipt.id, receipt.status === 'review')
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  const first = duplicates.data?.[0]
  if (receipt.status !== 'review' || dismissed || !first) return null

  return (
    <Alert aria-label="Möglicherweise doppelter Beleg">
      <CopyCheck aria-hidden />
      <AlertTitle>Das sieht nach einem doppelten Beleg aus</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {first.merchant} am {formatDate(first.purchased_at)} mit {first.item_count}{' '}
          {first.item_count === 1 ? 'Position' : 'Positionen'} und gleicher Preissumme liegt schon
          vor ({first.status === 'done' ? 'bestätigt' : 'noch zu prüfen'}).
          {duplicates.data && duplicates.data.length > 1 && ' Es gibt noch weitere davon.'} Doppelt
          bestätigt zählt er auch doppelt in deiner Summe.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/receipts/${first.id}`}>Anderen Beleg ansehen</Link>
          </Button>
          <DeleteReceiptButton
            receipt={receipt}
            label={receipt.merchant ?? 'Beleg'}
            buttonLabel="Diesen Beleg löschen"
            onDeleted={() => void navigate('/receipts')}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
            Trotzdem behalten
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
