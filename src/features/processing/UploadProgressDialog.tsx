import { FolderOpen, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { EmissionCategory } from '@/features/categories/categories'
import { ProgressPanel } from './components/ProgressPanel'
import { ReceiptPaper } from './components/ReceiptPaper'
import { STEP, STEPS } from './steps'

const NO_CATEGORIES: ReadonlyMap<string, EmissionCategory> = new Map()

type UploadProgressDialogProps = {
  fileName: string
  /** Object URL of the chosen photo (owned and revoked by the caller). */
  previewUrl: string | null
  failed: boolean
  onRetry: () => void
  onChooseOther: () => void
  onOpenChange: (open: boolean) => void
}

/**
 * Opens the moment a file is chosen – step one, the upload, runs here. When the receipt
 * exists, its page takes over with the same dialog (without a second entrance animation).
 */
export function UploadProgressDialog({
  fileName,
  previewUrl,
  failed,
  onRetry,
  onChooseOther,
  onOpenChange,
}: UploadProgressDialogProps) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="Schließen"
        className="sm:max-w-5xl md:h-[min(90svh,46rem)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const content = event.currentTarget
          if (content instanceof HTMLElement) content.focus()
        }}
      >
        <ProgressPanel
          step={STEP.upload}
          failed={failed}
          waiting={false}
          title={failed ? 'Upload fehlgeschlagen' : `${STEPS[STEP.upload].activity} …`}
          description={
            failed
              ? 'Das Foto konnte nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.'
              : 'Du kannst zusehen oder das Fenster schließen – die Analyse läuft weiter.'
          }
          fileName={fileName}
          paper={
            <ReceiptPaper
              step={STEP.upload}
              failed={false}
              merchant={null}
              purchasedAt={null}
              lines={null}
              categoriesById={NO_CATEGORIES}
              totalKg={0}
              photoUrl={previewUrl}
            />
          }
          actions={
            failed ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onChooseOther}
                  className="max-sm:flex-1"
                >
                  <FolderOpen aria-hidden />
                  Andere Datei
                </Button>
                <Button size="lg" onClick={onRetry} className="max-sm:flex-1">
                  <RotateCcw aria-hidden />
                  Erneut versuchen
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="max-sm:flex-1"
              >
                Im Hintergrund weiter
              </Button>
            )
          }
        />
      </DialogContent>
    </Dialog>
  )
}
