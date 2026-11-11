import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useDeleteReceipt } from '../queries'
import type { Receipt } from '../types'

export function DeleteReceiptButton({
  receipt,
  label,
  buttonLabel,
  onDeleted,
}: {
  receipt: Pick<Receipt, 'id' | 'file_path'>
  label: string
  /** Text button instead of the icon button, e.g. "Diesen Beleg löschen". */
  buttonLabel?: string
  onDeleted?: () => void
}) {
  const deleteReceipt = useDeleteReceipt()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {buttonLabel ? (
          <Button variant="outline" size="sm" disabled={deleteReceipt.isPending}>
            <Trash2 aria-hidden />
            {buttonLabel}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} löschen`}
            disabled={deleteReceipt.isPending}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Beleg löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{label}“ und alle erkannten Positionen werden dauerhaft gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => deleteReceipt.mutate(receipt, { onSuccess: onDeleted })}
          >
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
